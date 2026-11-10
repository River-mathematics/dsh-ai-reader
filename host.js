import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync, readdirSync, rmSync,
} from 'node:fs'
import { dirname, join, extname, basename, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const WORKER = join(ROOT, 'worker', 'main.py')
const CACHE = join(homedir(), '.dsh', 'cache', 'ai-reader')
const UPLOADS = join(CACHE, 'uploads')
const RECENT_FILE = join(CACHE, 'recent.json')
const DEFAULT_WORKSPACE = join(homedir(), 'Documents', 'deepseek-harness', 'default-workspace')
const WORKSPACE = process.env.DSH_AI_READER_WORKSPACE || (existsSync(DEFAULT_WORKSPACE) ? DEFAULT_WORKSPACE : process.cwd())
const PYTHON = process.env.DSH_AI_READER_PYTHON || 'python'
const EXTRACT_VERSION = 2
const TRANSLATION_VERSION = 3

const state = {
  docs: new Map(),
  recent: [],
  llm: null,
  modelCache: null,
  translating: new Map(),
  rendering: new Map(),
  workerSeq: 0,
  connection: false,
  webRoutes: false,
}

mkdirSync(CACHE, { recursive: true })
mkdirSync(UPLOADS, { recursive: true })

function ensureDir(dir) { mkdirSync(dir, { recursive: true }) }
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, Number(n))) }
function sha1(s) { return createHash('sha1').update(String(s)).digest('hex') }
function safeJson(text, fallback) { try { return JSON.parse(text) } catch { return fallback } }
function atomicWrite(file, text) {
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now()
  writeFileSync(tmp, text)
  renameSync(tmp, file)
}

function readRecent() {
  state.recent = safeJson(existsSync(RECENT_FILE) ? readFileSync(RECENT_FILE, 'utf8') : '[]', [])
  if (!Array.isArray(state.recent)) state.recent = []
}
readRecent()

function remember(doc) {
  const row = {
    id: doc.id, path: doc.path, title: doc.title, pageCount: doc.pageCount,
    openedAt: Date.now(),
  }
  state.recent = [row, ...state.recent.filter((x) => x.path !== doc.path)].slice(0, 30)
  persistRecent()
}

function persistRecent() {
  atomicWrite(RECENT_FILE, JSON.stringify(state.recent, null, 2))
}

function insidePath(child, parent) {
  if (!child || !parent) return false
  const c = resolve(child).toLowerCase()
  const p = resolve(parent).toLowerCase()
  return c === p || c.startsWith(p + sep)
}

function dirBytes(dir) {
  if (!existsSync(dir)) return 0
  let total = 0
  const walk = (current) => {
    let entries
    try { entries = readdirSync(current, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else {
        try { total += statSync(path).size } catch { /* ignore */ }
      }
    }
  }
  walk(dir)
  return total
}

function recentPublic() {
  return state.recent.map((row) => ({
    ...row,
    cacheBytes: dirBytes(join(CACHE, row.id)),
    source: insidePath(row.path, UPLOADS) ? 'upload' : 'workspace',
    exists: existsSync(row.path),
  }))
}

function removeRecent(id, deleteCache) {
  const row = state.recent.find((item) => item.id === id)
  state.recent = state.recent.filter((item) => item.id !== id)
  persistRecent()
  state.docs.delete(id)
  if (deleteCache && /^[a-f0-9]{12,64}$/.test(String(id))) {
    rmSync(join(CACHE, id), { recursive: true, force: true })
    if (row?.path && insidePath(row.path, UPLOADS)) rmSync(row.path, { force: true })
  }
  return { removed: row !== undefined, id }
}

function renameRecent(id, title) {
  const next = String(title || '').trim().slice(0, 200)
  if (!next) throw new Error('标题不能为空')
  const row = state.recent.find((item) => item.id === id)
  if (!row) throw new Error('最近文档中没有这一项')
  row.title = next
  const cached = state.docs.get(id)
  if (cached) cached.title = next
  const metaFile = join(CACHE, id, 'doc-v4.json')
  if (existsSync(metaFile)) {
    try {
      const data = JSON.parse(readFileSync(metaFile, 'utf8'))
      data.title = next
      atomicWrite(metaFile, JSON.stringify(data))
    } catch { /* keep recent title even if doc.json is unreadable */ }
  }
  persistRecent()
  return { id, title: next }
}

function clearRecent(deleteCache) {
  const ids = state.recent.map((row) => row.id)
  const uploadPaths = state.recent.filter((row) => insidePath(row.path, UPLOADS)).map((row) => row.path)
  state.recent = []
  persistRecent()
  for (const id of ids) {
    state.docs.delete(id)
    if (deleteCache && /^[a-f0-9]{12,64}$/.test(String(id))) rmSync(join(CACHE, id), { recursive: true, force: true })
  }
  if (deleteCache) for (const path of uploadPaths) rmSync(path, { force: true })
  return { cleared: ids.length }
}

function runWorker(args, payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(PYTHON, [WORKER, ...args], {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    const out = []
    const err = []
    child.stdout.on('data', (b) => out.push(b))
    child.stderr.on('data', (b) => err.push(b))
    child.on('error', reject)
    child.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8').trim()
      const stderr = Buffer.concat(err).toString('utf8').trim()
      if (code !== 0) {
        reject(new Error((stderr || stdout || `worker exited with ${code}`).slice(0, 4000)))
        return
      }
      const parsed = safeJson(stdout.split(/\r?\n/).filter(Boolean).pop() || '', null)
      if (parsed === null) reject(new Error(`worker returned non-JSON: ${stdout.slice(0, 1000)}`))
      else resolvePromise(parsed)
    })
    if (payload !== undefined) child.stdin.end(JSON.stringify(payload))
    else child.stdin.end()
  })
}

function docIdFor(path) {
  const st = statSync(path)
  return sha1(`v${EXTRACT_VERSION}|${resolve(path)}|${st.size}|${Math.round(st.mtimeMs)}`).slice(0, 16)
}

async function extractPdf(path, dir) {
  ensureDir(dir)
  const outFile = join(dir, 'extract.json')
  const result = await runWorker(['extract', path, outFile])
  if (!result?.ok) throw new Error(result?.error || 'PDF extraction failed')
  const data = JSON.parse(readFileSync(outFile, 'utf8'))
  return data
}

async function openPath(path) {
  const abs = resolve(String(path || '').trim())
  if (!existsSync(abs)) throw new Error(`文件不存在：${abs}`)
  if (extname(abs).toLowerCase() !== '.pdf') throw new Error('目前只支持 PDF 文件')
  const st = statSync(abs)
  if (st.size < 100) throw new Error('文件太小，可能不是有效 PDF')
  const id = docIdFor(abs)
  const cached = state.docs.get(id)
  if (cached !== undefined) { remember(cached); return publicDoc(cached) }
  const dir = join(CACHE, id)
  ensureDir(dir)
  let data
  const metaFile = join(dir, 'doc-v4.json')
  if (existsSync(metaFile)) {
    data = JSON.parse(readFileSync(metaFile, 'utf8'))
  } else {
    data = await extractPdf(abs, dir)
    atomicWrite(metaFile, JSON.stringify(data))
  }
  const doc = { ...data, id, path: abs, dir }
  state.docs.set(id, doc)
  remember(doc)
  return publicDoc(doc)
}

async function openUpload(buffer, filename) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) throw new Error('上传内容为空')
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('上传内容不是 PDF')
  const id = sha1(buffer).slice(0, 16)
  const file = join(UPLOADS, `${id}.pdf`)
  if (!existsSync(file)) writeFileSync(file, buffer)
  const doc = await openPath(file)
  const nice = String(filename || '').replace(/\.pdf$/i, '').trim().slice(0, 200)
  const generic = !doc.title
    || /^[a-f0-9]{12,64}$/i.test(doc.title)
    || /^(untitled|unknown|microsoft word|document\d*)$/i.test(doc.title)
    || doc.title === basename(file)
  if (nice && generic) {
    const internal = state.docs.get(doc.id)
    internal.title = nice
    doc.title = nice
    atomicWrite(join(internal.dir, 'doc-v4.json'), JSON.stringify({ title: internal.title, pageCount: internal.pageCount, pages: internal.pages, outline: internal.outline }))
    remember(internal)
  }
  return doc
}

function publicDoc(doc) {
  return {
    id: doc.id,
    title: doc.title,
    path: doc.path,
    pageCount: doc.pageCount,
    outline: doc.outline || [],
    pages: doc.pages.map((p) => ({
      page: p.page, width: p.width, height: p.height,
      blocks: p.blocks,
      figures: p.figures || [],
    })),
  }
}

function getDoc(id) {
  const doc = state.docs.get(id)
  if (doc === undefined) throw new Error('文档未打开或服务已重启，请重新打开 PDF')
  return doc
}

async function renderPage(doc, pageNumber, zoom) {
  const page = clamp(parseInt(pageNumber, 10), 1, doc.pageCount)
  const z = clamp(parseFloat(zoom) || 2, 1, 3)
  const file = join(doc.dir, `page-${String(page).padStart(4, '0')}-z${z.toFixed(1)}.png`)
  if (existsSync(file) && statSync(file).size > 100) return readFileSync(file)
  const key = `${doc.id}:${page}:${z}`
  if (state.rendering.has(key)) return state.rendering.get(key)
  const job = (async () => {
    const result = await runWorker(['render', doc.path, String(page), String(z), file])
    if (!result?.ok) throw new Error(result?.error || '页面渲染失败')
    return readFileSync(file)
  })().finally(() => state.rendering.delete(key))
  state.rendering.set(key, job)
  return job
}

function loadTranslationCache(doc) {
  const file = join(doc.dir, 'translations.json')
  if (!doc._trCache) doc._trCache = safeJson(existsSync(file) ? readFileSync(file, 'utf8') : '{}', {})
  return doc._trCache
}

function saveTranslationCache(doc) {
  if (!doc._trCache) return
  atomicWrite(join(doc.dir, 'translations.json'), JSON.stringify(doc._trCache))
}

async function listModels(llm) {
  if (state.modelCache && Date.now() - state.modelCache.at < 60_000) return state.modelCache.value
  const providers = typeof llm.listProviders === 'function' ? llm.listProviders() : []
  const value = []
  for (const provider of providers) {
    let models = []
    try { models = await llm.listModels(provider.id) } catch { models = [] }
    value.push({ id: provider.id, name: provider.name || provider.id, models: models.map((m) => ({ id: m.id, name: m.name || m.id })) })
  }
  state.modelCache = { at: Date.now(), value }
  return value
}

async function pickModel(llm, requestedModel) {
  const providers = await listModels(llm)
  if (providers.length === 0) throw new Error('没有可用的模型提供方')
  const preferredProvider = process.env.DSH_AI_READER_PROVIDER
  const provider = providers.find((p) => p.id === preferredProvider)
    || providers.find((p) => p.id === 'deepseek-account')
    || providers.find((p) => p.models.length > 0)
    || providers[0]
  const model = String(requestedModel || '').trim()
    || process.env.DSH_AI_READER_MODEL
    || provider.models.find((m) => m.id === 'deepseek-flash')?.id
    || provider.models.find((m) => m.id.includes('flash'))?.id
    || provider.models[0]?.id
  if (!model) throw new Error(`模型提供方 ${provider.id} 没有可用模型`)
  return { provider: provider.id, model }
}

const SYSTEM_PROMPT = `你是一位严谨的学术论文翻译专家。你的任务是把论文段落准确翻译成目标语言，供研究者对照阅读。
要求：
1. 忠实原意，不增删、不概括、不解释；保持学术语体，句子通顺。
2. 数学公式、变量名、数字、引用编号（如 [12]、(Smith et al., 2020)）、图表编号、URL、代码、专有名词保持原样。
3. 领域术语使用中文学界通行译法；必要时在该术语首次出现时用括号保留英文原名。
4. 不翻译段落前的编号或项目符号，只翻译正文。
5. 严格按指定格式输出，不要添加任何前后说明。`

function buildUserPrompt(items, target, style, docTitle, section, glossary = []) {
  const lang = target === 'en' ? 'English' : target === 'zh' ? '简体中文' : target
  const styleText = style === 'literal' ? '直译，尽量贴近原文语序，但必须通顺。'
    : style === 'plain' ? '通俗清楚，面向非本领域读者，术语第一次出现时加英文。'
      : '学术论文风格，准确、简洁、专业。'
  const terms = glossary
    .filter((item) => item && item.src && item.dst)
    .map((item) => `- ${item.src} => ${item.dst}`)
    .join('\n')
  const blocks = items.map((b) => `@@@${b.id}@@@\n${b.text}`).join('\n\n')
  return `把下面这篇论文的段落翻译成${lang}。
文档标题：${docTitle || '（未命名）'}
所在章节：${section || '（未知）'}
风格：${styleText}
${terms ? `术语表（必须遵守；locked 表示保留原文）：\n${terms}\n` : ''}
输出格式：每个段落以 @@@段落ID@@@ 单独一行开头，紧接着是译文；不要输出原文，不要使用 Markdown 代码块。必须覆盖所有段落，顺序与输入一致。

${blocks}`
}

function parseTagged(text, ids) {
  const out = {}
  const re = /@@@\s*([A-Za-z0-9_-]+)\s*@@@\s*([\s\S]*?)(?=@@@\s*[A-Za-z0-9_-]+\s*@@@|$)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const id = m[1]
    let value = m[2].trim()
    value = value.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim()
    if (ids.has(id) && value) out[id] = value
  }
  if (Object.keys(out).length === 0) {
    const parts = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
    if (parts.length === ids.size) {
      let i = 0
      for (const id of ids) out[id] = parts[i++]
    }
  }
  return out
}

async function callModel(items, target, style, doc, page, requestedModel, glossary = []) {
  const llm = state.llm || (typeof globalThis.__DSH_AI_READER_CTX__?.get === 'function' ? globalThis.__DSH_AI_READER_CTX__.get('llm') : null)
  if (!llm) throw new Error('模型服务尚未就绪，请稍后重试')
  const { provider, model } = await pickModel(llm, requestedModel)
  const section = (page.blocks || []).find((b) => b.role === 'heading')?.text || ''
  const user = buildUserPrompt(items, target, style, doc.title, section, glossary)
  const messages = [
    { role: 'system', content: [{ type: 'text', text: SYSTEM_PROMPT }] },
    { role: 'user', content: [{ type: 'text', text: user }] },
  ]
  const base = {
    provider, model, messages,
    temperature: 0.15,
    maxTokens: 4096,
  }
  let text = ''
  let finish = null
  const run = async (options) => {
    text = ''
    finish = null
    for await (const chunk of llm.stream(options)) {
      if (chunk.type === 'text-delta') text += chunk.text
      else if (chunk.type === 'finish') finish = chunk.reason
    }
  }
  try {
    await run({ ...base, reasoningEffort: 'off' })
  } catch (error) {
    const message = String(error?.message || error)
    if (/reasoning|effort|INVALID/i.test(message)) await run(base)
    else throw error
  }
  if (finish?.kind === 'error') {
    throw new Error(finish.failure?.message || finish.failure?.code || '模型调用失败')
  }
  const parsed = parseTagged(text, new Set(items.map((b) => b.id)))
  if (Object.keys(parsed).length === 0) throw new Error(`模型输出无法解析：${text.slice(0, 300)}`)
  return parsed
}

function batchesFor(blocks, maxBlocks = 5, maxChars = 4200) {
  const out = []
  let cur = []
  let chars = 0
  for (const b of blocks) {
    const len = b.text.length
    if (cur.length > 0 && (cur.length >= maxBlocks || chars + len > maxChars)) {
      out.push(cur); cur = []; chars = 0
    }
    cur.push(b); chars += len
  }
  if (cur.length > 0) out.push(cur)
  return out
}

function persistDocMeta(doc) {
  atomicWrite(join(doc.dir, 'doc-v4.json'), JSON.stringify({
    title: doc.title, pageCount: doc.pageCount, pages: doc.pages, outline: doc.outline || [],
  }))
}

function nearestCaption(page, bbox) {
  const [x0, y0, x1, y1] = bbox
  const candidates = []
  for (const block of page.blocks || []) {
    if (block.role !== 'caption') continue
    const bb = block.bbox
    const overlap = Math.min(x1, bb[2]) - Math.max(x0, bb[0])
    if (overlap < Math.min(x1 - x0, bb[2] - bb[0]) * 0.15) continue
    const below = Math.abs(bb[1] - y1)
    const above = Math.abs(y0 - bb[3])
    const distance = Math.min(below, above)
    if (distance < 180) candidates.push({ block, distance })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.distance - b.distance)
  return candidates[0].block
}

function figureLabel(text, kind, fallback) {
  const match = String(text || '').match(/(?:figure|fig\.?|图|table|表)\s*([0-9]+(?:\.[0-9]+)?)/i)
  if (match) return `${kind === 'table' ? '表' : '图'} ${match[1]}`
  return `${kind === 'table' ? '表' : '图'} ${fallback}`
}

function manualAfterBlock(page, bbox) {
  const [x0, y0, x1] = bbox
  const boxes = (page.figures || []).map((figure) => figure.bbox).filter((box) => Array.isArray(box))
  const inside = (block) => {
    const x = (block.bbox[0] + block.bbox[2]) / 2
    const y = (block.bbox[1] + block.bbox[3]) / 2
    return boxes.some((box) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3])
  }
  const candidates = (page.blocks || []).filter((block) => {
    if (block.role === 'caption' || block.role === 'header' || block.role === 'footer') return false
    if (block.bbox[3] > y0 + 4 || inside(block)) return false
    if (x1 - x0 > page.width * 0.62) return true
    return ((block.bbox[0] + block.bbox[2]) / 2 < page.width / 2) === ((x0 + x1) / 2 < page.width / 2)
  })
  return candidates.length ? candidates.reduce((a, b) => a.bbox[3] > b.bbox[3] ? a : b).id : null
}

async function addManualFigure(doc, pageNumber, bbox) {
  const page = doc.pages[clamp(parseInt(pageNumber, 10), 1, doc.pageCount) - 1]
  if (!page) throw new Error('页码无效')
  const width = page.width
  const height = page.height
  let [x0, y0, x1, y1] = bbox.map((value) => Math.max(0, Math.min(1, Number(value))))
  if (!(x1 - x0 > 0.01 && y1 - y0 > 0.01)) throw new Error('框选区域太小')
  const points = [x0 * width, y0 * height, x1 * width, y1 * height]
  const id = `m${Date.now().toString(36)}`
  const name = `manual-p${String(page.page).padStart(4, '0')}-${id}.png`
  const rel = `figures/${name}`
  const out = join(doc.dir, rel)
  const result = await runWorker(['crop', doc.path, String(page.page),
    String(points[0]), String(points[1]), String(points[2]), String(points[3]), out])
  if (!result?.ok) throw new Error(result?.error || '图表裁剪失败')
  const caption = nearestCaption(page, points)
  const captionText = caption ? caption.text : ''
  const kind = /^(table|表)\s*\d+/i.test(captionText) ? 'table' : 'figure'
  const figure = {
    id, kind, label: figureLabel(captionText, kind, (page.figures || []).length + 1),
    confidence: 1, bbox: points.map((v) => Math.round(v * 100) / 100),
    width: result.width, height: result.height, file: rel,
    captionBlockId: caption ? caption.id : null, caption: captionText,
    afterBlockId: manualAfterBlock(page, points),
    order: (page.figures || []).length,
    ocr: result.ocr || [], ocrError: result.ocrError || null, source: 'manual',
  }
  page.figures = [...(page.figures || []), figure]
  persistDocMeta(doc)
  return figure
}

function removeFigure(doc, pageNumber, figureId) {
  const page = doc.pages[clamp(parseInt(pageNumber, 10), 1, doc.pageCount) - 1]
  if (!page) throw new Error('页码无效')
  const figure = (page.figures || []).find((item) => item.id === figureId)
  if (!figure) throw new Error('图表不存在')
  page.figures = page.figures.filter((item) => item.id !== figureId)
  if (figure.file && insidePath(resolve(doc.dir, figure.file), join(doc.dir, 'figures'))) {
    rmSync(resolve(doc.dir, figure.file), { force: true })
  }
  persistDocMeta(doc)
  return { removed: true, id: figureId }
}

async function translatePage(doc, pageNumber, target, style, force, requestedModel, glossary = []) {
  const page = doc.pages[clamp(parseInt(pageNumber, 10), 1, doc.pageCount) - 1]
  const modelName = String(requestedModel || '').trim()
  const terms = Array.isArray(glossary) ? glossary.filter((item) => item && item.src && item.dst) : []
  const glossaryHash = sha1(JSON.stringify(terms)).slice(0, 12)
  const key = `${doc.id}|${page.page}|${target}|${style}|${modelName}|${glossaryHash}`
  if (state.translating.has(key)) return state.translating.get(key)
  const job = (async () => {
    const cache = loadTranslationCache(doc)
    const targetLang = target || 'zh'
    const styleName = style || 'academic'
    const figureBoxes = (page.figures || []).map((figure) => figure.bbox || []).filter((box) => box.length === 4)
    const insideFigure = (block) => {
      const x = (block.bbox[0] + block.bbox[2]) / 2
      const y = (block.bbox[1] + block.bbox[3]) / 2
      return figureBoxes.some((box) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3])
    }
    const blocks = (page.blocks || []).filter((b) => b.text && b.text.trim().length > 1 && !['header', 'footer', 'figure', 'meta', 'label', 'formula', 'table'].includes(b.role)
      && !(b.role !== 'caption' && insideFigure(b)))
    const ocrItems = []
    for (const figure of page.figures || []) {
      const lines = Array.isArray(figure.ocr) ? figure.ocr : []
      lines.forEach((line, index) => {
        const text = String(line?.text || '').trim()
        if (text.length > 1) ocrItems.push({ id: `${figure.id}-o${index + 1}`, text })
      })
    }
    const items = [...blocks, ...ocrItems]
    const translations = {}
    const pending = []
    const cacheKey = (text) => `${TRANSLATION_VERSION}|${targetLang}|${styleName}|${modelName}|${glossaryHash}|${sha1(text)}`
    for (const b of items) {
      const ck = cacheKey(b.text)
      if (!force && cache[ck]) translations[b.id] = cache[ck]
      else pending.push(b)
    }
    const failures = []
    if (pending.length > 0) {
      const batches = batchesFor(pending, 8, 5000)
      const concurrency = 3
      let cursor = 0
      const workers = Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
        while (cursor < batches.length) {
          const batch = batches[cursor++]
          try {
            const parsed = await callModel(batch, targetLang, styleName, doc, page, modelName, terms)
            for (const b of batch) {
              const value = parsed[b.id]
              if (value) {
                translations[b.id] = value
                cache[cacheKey(b.text)] = value
              } else {
                failures.push({ id: b.id, error: 'missing in model output' })
              }
            }
            saveTranslationCache(doc)
          } catch (error) {
            for (const b of batch) failures.push({ id: b.id, error: String(error?.message || error) })
          }
        }
      })
      await Promise.all(workers)
      saveTranslationCache(doc)
    }
    let model = modelName
    try { model = (await pickModel(state.llm, modelName)).model } catch { /* ignore */ }
    return { translations, failures, model, page: page.page }
  })().finally(() => state.translating.delete(key))
  state.translating.set(key, job)
  return job
}

function scanPdfs(root, max = 240) {
  const out = []
  const skip = new Set(['node_modules', '.git', '.dsh-market', 'cache', 'dist', 'build', '__pycache__'])
  const walk = (dir, depth) => {
    if (out.length >= max || depth > 5) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (out.length >= max) return
      if (entry.name.startsWith('.') || skip.has(entry.name)) continue
      const p = join(dir, entry.name)
      if (entry.isDirectory()) { walk(p, depth + 1); continue }
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.pdf') continue
      try {
        const st = statSync(p)
        if (st.size < 1000) continue
        out.push({ path: p, rel: relative(root, p), name: basename(p), size: st.size, mtime: st.mtimeMs })
      } catch { /* ignore */ }
    }
  }
  walk(root, 0)
  return out.sort((a, b) => b.mtime - a.mtime)
}

function jsonResult(status, value) {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: Buffer.from(JSON.stringify(value)) }
}

function errResult(status, message) { return jsonResult(status, { error: String(message || 'unknown error') }) }

async function readNodeBody(req, limit = 120 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function handleCore(route, { method, query, body, headers }) {
  try {
    switch (route) {
      case '/api/ai-reader/config': {
        const llm = state.llm
        let providers = []
        try { if (llm) providers = await listModels(llm) } catch { providers = [] }
        return jsonResult(200, {
          workspace: WORKSPACE,
          python: PYTHON,
          providers,
          defaults: { target: 'zh', style: 'academic', auto: true, model: process.env.DSH_AI_READER_MODEL || 'deepseek-flash' },
          carrier: state.connection,
          version: '0.4.0',
        })
      }
      case '/api/ai-reader/library': {
        const root = query.get('root') || WORKSPACE
        return jsonResult(200, { root, files: scanPdfs(root) })
      }
      case '/api/ai-reader/recent': {
        return jsonResult(200, { files: recentPublic() })
      }
      case '/api/ai-reader/recent/rename': {
        const payload = safeJson(body.toString('utf8'), null)
        if (!payload || typeof payload.id !== 'string') return errResult(400, '缺少 id')
        return jsonResult(200, renameRecent(payload.id, payload.title))
      }
      case '/api/ai-reader/recent/delete': {
        const payload = safeJson(body.toString('utf8'), null)
        if (!payload || typeof payload.id !== 'string') return errResult(400, '缺少 id')
        return jsonResult(200, removeRecent(payload.id, payload.deleteCache === true))
      }
      case '/api/ai-reader/recent/clear': {
        const payload = safeJson(body.toString('utf8'), {}) || {}
        return jsonResult(200, clearRecent(payload.deleteCache === true))
      }
      case '/api/ai-reader/open': {
        const payload = safeJson(body.toString('utf8'), null)
        if (!payload || typeof payload.path !== 'string') return errResult(400, '缺少 path')
        const doc = await openPath(payload.path)
        return jsonResult(200, doc)
      }
      case '/api/ai-reader/upload': {
        const name = decodeURIComponent(headers['x-filename'] || 'uploaded.pdf')
        const doc = await openUpload(body, name)
        return jsonResult(200, doc)
      }
      case '/api/ai-reader/doc': {
        const doc = getDoc(query.get('id') || '')
        return jsonResult(200, publicDoc(doc))
      }
      case '/api/ai-reader/page': {
        const doc = getDoc(query.get('id') || '')
        const png = await renderPage(doc, query.get('page') || '1', query.get('zoom') || '2')
        return { status: 200, headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' }, body: png }
      }
      case '/api/ai-reader/figure': {
        const doc = getDoc(query.get('id') || '')
        const file = String(query.get('file') || '')
        const abs = resolve(doc.dir, file)
        if (!file || !insidePath(abs, join(doc.dir, 'figures')) || !existsSync(abs)) {
          return errResult(404, 'figure not found')
        }
        return { status: 200, headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' }, body: readFileSync(abs) }
      }
      case '/api/ai-reader/figure/manual': {
        const payload = safeJson(body.toString('utf8'), null)
        if (!payload || typeof payload.id !== 'string' || !Array.isArray(payload.bbox)) return errResult(400, '缺少 id 或 bbox')
        const doc = getDoc(payload.id)
        const figure = await addManualFigure(doc, payload.page || 1, payload.bbox)
        return jsonResult(200, { figure })
      }
      case '/api/ai-reader/figure/remove': {
        const payload = safeJson(body.toString('utf8'), null)
        if (!payload || typeof payload.id !== 'string' || typeof payload.figureId !== 'string') return errResult(400, '缺少 id 或 figureId')
        return jsonResult(200, removeFigure(getDoc(payload.id), payload.page || 1, payload.figureId))
      }
      case '/api/ai-reader/translate': {
        const payload = safeJson(body.toString('utf8'), null)
        if (!payload || typeof payload.id !== 'string') return errResult(400, '缺少 id')
        const doc = getDoc(payload.id)
        const result = await translatePage(doc, payload.page || 1, payload.target || 'zh', payload.style || 'academic', payload.force === true, payload.model, payload.glossary)
        return jsonResult(200, result)
      }
      default:
        return errResult(404, 'not found')
    }
  } catch (error) {
    return errResult(500, error?.message || error)
  }
}

function nodeHandler(routeKey) {
  return async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const body = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readNodeBody(req)
    const result = await handleCore(routeKey, {
      method: req.method, query: url.searchParams, body, headers: req.headers,
    })
    res.writeHead(result.status, result.headers)
    if (req.method === 'HEAD') res.end()
    else res.end(result.body)
  }
}

function fetchHandler(routeKey) {
  return async (request) => {
    const url = new URL(request.url)
    const body = request.method === 'GET' || request.method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await request.arrayBuffer())
    const headers = {}
    request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })
    const result = await handleCore(routeKey, { method: request.method, query: url.searchParams, body, headers })
    return new Response(result.body, { status: result.status, headers: result.headers })
  }
}

const ROUTES = [
  { path: '/api/ai-reader/config', methods: ['GET'] },
  { path: '/api/ai-reader/library', methods: ['GET'] },
  { path: '/api/ai-reader/recent', methods: ['GET'] },
  { path: '/api/ai-reader/recent/rename', methods: ['POST'] },
  { path: '/api/ai-reader/recent/delete', methods: ['POST'] },
  { path: '/api/ai-reader/recent/clear', methods: ['POST'] },
  { path: '/api/ai-reader/open', methods: ['POST'] },
  { path: '/api/ai-reader/upload', methods: ['POST'] },
  { path: '/api/ai-reader/doc', methods: ['GET'] },
  { path: '/api/ai-reader/page', methods: ['GET'] },
  { path: '/api/ai-reader/figure', methods: ['GET'] },
  { path: '/api/ai-reader/figure/manual', methods: ['POST'] },
  { path: '/api/ai-reader/figure/remove', methods: ['POST'] },
  { path: '/api/ai-reader/translate', methods: ['POST'] },
]

export async function apply(ctx) {
  ensureDir(CACHE)
  ctx.inject(['llm'], (child) => {
    state.llm = child.llm
    return () => { if (state.llm === child.llm) state.llm = null }
  })
  ctx.inject(['webServer'], (child) => {
    const disposers = []
    for (const route of ROUTES) {
      try {
        disposers.push(child.webServer.register({
          kind: 'exact',
          path: route.path,
          handler: nodeHandler(route.path),
        }))
      } catch (error) {
        // A previous host instance may still own an older exact route during a
        // hot reload. Do not fail the whole plugin; a restart will clean it.
        console.warn('[ai-reader] route not registered', route.path, error?.message || error)
      }
    }
    state.webRoutes = true
    return () => { state.webRoutes = false; for (const dispose of disposers) dispose() }
  })
  ctx.inject(['connection'], (child) => {
    const conn = child.connection
    if (conn === undefined || typeof conn.registerFetchRoute !== 'function') return
    const disposers = []
    for (const route of ROUTES) {
      try {
        disposers.push(conn.registerFetchRoute(ctx, {
          path: route.path,
          methods: route.methods,
          requestBody: 'buffered',
          fetch: fetchHandler(route.path),
        }))
      } catch (error) {
        console.warn('[ai-reader] fetch route not registered', route.path, error?.message || error)
      }
    }
    state.connection = true
    return () => { state.connection = false; for (const dispose of disposers) dispose() }
  })
  ctx.logger?.info?.('[ai-reader] ready')
}
