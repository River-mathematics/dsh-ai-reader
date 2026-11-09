window.__ModuleLoader__.load({
  id: 'dsh-ai-reader',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    const API = '/api/ai-reader'

    const CSS = `
.air-host { height: 100%; min-height: 0; }
.air-root {
  --air-bg: #f6f5f1;
  --air-panel: #ffffff;
  --air-panel-2: #fbfaf7;
  --air-border: #e7e3da;
  --air-border-strong: #d8d2c6;
  --air-text: #24211c;
  --air-muted: #777065;
  --air-faint: #a39b8e;
  --air-accent: #3f6df6;
  --air-accent-soft: #eef2ff;
  --air-serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, "Songti SC", SimSun, serif;
  --air-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  height: 100%; min-height: 0; display: flex; flex-direction: column;
  background: var(--air-bg); color: var(--air-text); font-family: var(--air-sans);
  position: relative; overflow: hidden;
}
body[data-ds-dark-theme] .air-root {
  --air-bg: #171716;
  --air-panel: #201f1d;
  --air-panel-2: #1b1a18;
  --air-border: #33312c;
  --air-border-strong: #454138;
  --air-text: #ebe7df;
  --air-muted: #a49d90;
  --air-faint: #6f695f;
  --air-accent: #7d9bff;
  --air-accent-soft: #232a44;
}
.air-root * { box-sizing: border-box; }
.air-root button, .air-root select, .air-root input { font: inherit; }
.air-head {
  height: 58px; flex: 0 0 58px; display: flex; align-items: center; gap: 14px;
  padding: 0 18px; border-bottom: 1px solid var(--air-border);
  background: color-mix(in srgb, var(--air-panel) 88%, transparent);
  backdrop-filter: blur(14px); position: relative; z-index: 20;
}
.air-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
.air-brand-mark { width: 26px; height: 26px; border-radius: 8px; background: var(--air-accent); color: #fff; display: grid; place-items: center; flex: none; }
.air-brand-name { font-weight: 700; font-size: 15px; letter-spacing: .2px; white-space: nowrap; }
.air-brand-sub { color: var(--air-faint); font-size: 11.5px; white-space: nowrap; }
.air-head-spacer { flex: 1 1 auto; }
.air-tools { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.air-btn {
  height: 32px; border: 1px solid var(--air-border-strong); background: var(--air-panel);
  color: var(--air-text); border-radius: 8px; padding: 0 11px; display: inline-flex;
  align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; font-size: 12.5px;
  transition: border-color .15s, background .15s, color .15s;
}
.air-btn:hover { border-color: var(--air-accent); color: var(--air-accent); }
.air-btn.primary { background: var(--air-accent); border-color: var(--air-accent); color: #fff; }
.air-btn.primary:hover { filter: brightness(1.06); color: #fff; }
.air-btn.ghost { border-color: transparent; background: transparent; color: var(--air-muted); }
.air-btn.ghost:hover { background: var(--air-accent-soft); color: var(--air-accent); }
.air-btn:disabled { opacity: .5; cursor: default; }
.air-seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--air-panel-2); border: 1px solid var(--air-border); border-radius: 9px; }
.air-seg button { border: 0; background: transparent; color: var(--air-muted); height: 26px; padding: 0 10px; border-radius: 6px; cursor: pointer; font-size: 12px; }
.air-seg button.on { background: var(--air-panel); color: var(--air-text); box-shadow: 0 1px 2px rgba(0,0,0,.08); font-weight: 600; }
.air-field { display: inline-flex; align-items: center; gap: 5px; color: var(--air-faint); font-size: 11.5px; }
.air-field select { height: 30px; border: 1px solid var(--air-border); background: var(--air-panel); color: var(--air-text); border-radius: 7px; padding: 0 6px; font-size: 12px; cursor: pointer; }
.air-body { flex: 1 1 auto; min-height: 0; display: flex; position: relative; }
.air-side {
  width: 272px; flex: none; border-right: 1px solid var(--air-border); background: var(--air-panel-2);
  display: flex; flex-direction: column; min-height: 0; transition: margin-left .2s ease;
}
.air-root.side-closed .air-side { margin-left: -272px; }
.air-side-head { padding: 15px 16px 10px; display: flex; align-items: center; gap: 8px; }
.air-side-title { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--air-faint); }
.air-side-tabs { display: flex; gap: 2px; padding: 0 12px 8px; }
.air-side-tabs button { flex: 1; border: 0; background: transparent; color: var(--air-muted); font-size: 12px; padding: 7px 0; border-radius: 7px; cursor: pointer; }
.air-side-tabs button.on { background: var(--air-panel); color: var(--air-text); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
.air-search { margin: 0 12px 8px; position: relative; }
.air-search input { width: 100%; height: 32px; border: 1px solid var(--air-border); border-radius: 8px; background: var(--air-panel); color: var(--air-text); padding: 0 10px 0 30px; font-size: 12px; outline: none; }
.air-search input:focus { border-color: var(--air-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--air-accent) 15%, transparent); }
.air-search svg { position: absolute; left: 9px; top: 9px; color: var(--air-faint); }
.air-doclist { flex: 1; overflow: auto; padding: 4px 8px 16px; }
.air-doc-row { padding: 9px 10px; border-radius: 8px; cursor: pointer; display: flex; gap: 9px; align-items: flex-start; }
.air-doc-row:hover { background: var(--air-panel); }
.air-doc-row.on { background: var(--air-accent-soft); }
.air-doc-row svg { flex: none; margin-top: 2px; color: var(--air-faint); }
.air-doc-row.on svg { color: var(--air-accent); }
.air-doc-main { min-width: 0; }
.air-doc-name { font-size: 12.5px; line-height: 1.45; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.air-doc-meta { color: var(--air-faint); font-size: 10.5px; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.air-side-empty { color: var(--air-faint); font-size: 12px; padding: 18px 14px; line-height: 1.7; }
.air-side-foot { border-top: 1px solid var(--air-border); padding: 11px 14px; color: var(--air-faint); font-size: 11px; line-height: 1.6; }
.air-main { flex: 1; min-width: 0; min-height: 0; position: relative; display: flex; flex-direction: column; }
.air-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 32px; }
.air-empty-card { max-width: 520px; text-align: center; }
.air-empty-icon { width: 74px; height: 74px; border-radius: 22px; background: var(--air-panel); border: 1px solid var(--air-border); display: grid; place-items: center; margin: 0 auto 18px; color: var(--air-accent); box-shadow: 0 10px 30px rgba(0,0,0,.05); }
.air-empty h2 { margin: 0 0 8px; font-size: 21px; letter-spacing: .2px; }
.air-empty p { margin: 0 0 18px; color: var(--air-muted); font-size: 13px; line-height: 1.75; }
.air-empty-actions { display: flex; gap: 9px; justify-content: center; flex-wrap: wrap; }
.air-drop { margin-top: 24px; border: 1.5px dashed var(--air-border-strong); border-radius: 14px; padding: 18px; color: var(--air-faint); font-size: 12px; }
.air-scroll { flex: 1; overflow: auto; scroll-behavior: smooth; display: none; }
.air-root.has-doc .air-scroll { display: block; }
.air-root.has-doc .air-empty { display: none; }
.air-doc-head { max-width: 1180px; margin: 0 auto; padding: 26px 28px 4px; }
.air-doc-title { font-family: var(--air-serif); font-size: 25px; line-height: 1.35; margin: 0 0 7px; letter-spacing: -.01em; }
.air-doc-sub { color: var(--air-faint); font-size: 11.5px; display: flex; gap: 10px; flex-wrap: wrap; }
.air-page { max-width: 1180px; margin: 0 auto; padding: 20px 28px 44px; }
.air-page-head { display: flex; align-items: center; gap: 10px; padding: 0 0 10px; border-bottom: 1px solid var(--air-border); margin-bottom: 16px; }
.air-page-no { font-size: 12px; font-weight: 700; letter-spacing: .06em; color: var(--air-faint); text-transform: uppercase; }
.air-chip { font-size: 10.5px; padding: 2px 7px; border-radius: 999px; background: var(--air-panel-2); border: 1px solid var(--air-border); color: var(--air-muted); }
.air-chip.loading { color: var(--air-accent); border-color: color-mix(in srgb, var(--air-accent) 35%, transparent); background: var(--air-accent-soft); }
.air-chip.done { color: #23834a; border-color: #b9dfc7; background: #f0faf3; }
.air-chip.error { color: #b33a3a; border-color: #e8c1c1; background: #fdf3f3; }
body[data-ds-dark-theme] .air-chip.done { color: #7cd79a; background: #1d2b22; border-color: #2d4a36; }
body[data-ds-dark-theme] .air-chip.error { color: #f09a9a; background: #2c1e1e; border-color: #4a2e2e; }
.air-page-head .air-page-spacer { flex: 1; }
.air-page-grid { display: grid; grid-template-columns: minmax(320px, 45%) minmax(0, 1fr); gap: 30px; align-items: start; }
.air-visual-wrap { position: sticky; top: 10px; }
.air-visual { position: relative; background: #fff; border: 1px solid var(--air-border); border-radius: 4px; box-shadow: 0 12px 32px rgba(29, 25, 18, .1); overflow: hidden; min-height: 160px; }
.air-visual img { display: block; width: 100%; height: auto; }
.air-overlay-layer { position: absolute; inset: 0; pointer-events: none; }
.air-overlay { pointer-events: auto; }
.air-visual-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #9a9387; font-size: 12px; background: #fbfaf7; }
.air-overlay { position: absolute; border-radius: 3px; background: rgba(255, 253, 246, .965); color: #1c1a17; border: 1px solid rgba(190, 172, 137, .35); box-shadow: 0 1px 3px rgba(30, 24, 15, .12); padding: 3px 4px; overflow: hidden; line-height: 1.28; font-family: var(--air-sans); cursor: default; }
.air-overlay.heading { background: rgba(255, 251, 238, .98); font-weight: 700; border-color: rgba(190, 160, 100, .5); }
.air-overlay:hover { outline: 2px solid var(--air-accent); outline-offset: 1px; z-index: 5; }
.air-blocks { min-width: 0; padding-bottom: 30px; }
.air-block { padding: 9px 0 13px; border-bottom: 1px dashed color-mix(in srgb, var(--air-border) 80%, transparent); }
.air-block:last-child { border-bottom: 0; }
.air-block-orig { color: var(--air-muted); font-family: var(--air-serif); font-size: 13px; line-height: 1.62; }
.air-block-zh { font-family: var(--air-serif); font-size: 15.5px; line-height: 1.82; margin-top: 6px; letter-spacing: .01em; white-space: pre-wrap; }
.air-block.heading { padding-top: 16px; }
.air-block.heading .air-block-orig { font-family: var(--air-sans); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.air-block.heading .air-block-zh { font-family: var(--air-sans); font-size: 19px; line-height: 1.45; font-weight: 700; }
.air-block.caption .air-block-zh { font-size: 13.5px; color: var(--air-muted); }
.air-block.hide-orig .air-block-orig { display: none; }
.air-block .air-skel { display: inline-block; height: 1em; border-radius: 4px; background: linear-gradient(90deg, var(--air-border) 20%, var(--air-panel-2) 45%, var(--air-border) 70%); background-size: 220% 100%; animation: airShimmer 1.5s linear infinite; width: 72%; }
.air-block .air-wait { color: var(--air-faint); font-size: 12px; font-family: var(--air-sans); }
@keyframes airShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
.air-toast { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%) translateY(10px); background: #1f1d1a; color: #fff; font-size: 12px; padding: 9px 14px; border-radius: 9px; opacity: 0; pointer-events: none; transition: .2s; z-index: 60; max-width: 80%; text-align: center; }
.air-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.air-toast.bad { background: #8f2f2f; }
.air-foot { height: 32px; flex: 0 0 32px; border-top: 1px solid var(--air-border); display: flex; align-items: center; gap: 14px; padding: 0 16px; color: var(--air-faint); font-size: 11px; background: var(--air-panel-2); }
.air-foot .grow { flex: 1; }
.air-foot label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.air-foot input[type=checkbox] { accent-color: var(--air-accent); }
.air-loading-mask { position: absolute; inset: 0; background: color-mix(in srgb, var(--air-bg) 80%, transparent); display: grid; place-items: center; z-index: 30; backdrop-filter: blur(2px); }
.air-loading-card { background: var(--air-panel); border: 1px solid var(--air-border); border-radius: 14px; padding: 22px 26px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,.12); min-width: 240px; }
.air-spinner { width: 26px; height: 26px; border: 2.5px solid var(--air-border); border-top-color: var(--air-accent); border-radius: 50%; margin: 0 auto 12px; animation: airSpin .8s linear infinite; }
@keyframes airSpin { to { transform: rotate(360deg); } }
.air-root.mode-immerse .air-page-grid, .air-root.mode-original .air-page-grid { grid-template-columns: minmax(0, 1fr); }
.air-root.mode-immerse .air-blocks, .air-root.mode-original .air-blocks { display: none; }
.air-root.mode-immerse .air-visual-wrap, .air-root.mode-original .air-visual-wrap { position: static; }
.air-root.mode-immerse .air-visual, .air-root.mode-original .air-visual { max-width: 920px; margin: 0 auto; }
.air-root.mode-immerse .air-overlay { display: block; }
.air-overlay { display: none; }
.air-root.mode-original .air-overlay { display: none; }
.air-root.txt-only .air-block-orig { display: none; }
.air-outline { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 0 0; }
.air-outline button { border: 1px solid var(--air-border); background: var(--air-panel); color: var(--air-muted); border-radius: 999px; padding: 4px 9px; font-size: 11px; cursor: pointer; }
.air-outline button:hover { color: var(--air-accent); border-color: var(--air-accent); }
.air-narrow-hint { display: none; }
.air-lightbox { position: fixed; inset: 0; z-index: 100; background: rgba(15, 14, 12, .82); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; backdrop-filter: blur(6px); }
.air-lightbox img { max-width: 94vw; max-height: 88vh; object-fit: contain; background: #fff; box-shadow: 0 30px 90px rgba(0,0,0,.4); border-radius: 3px; }
.air-lightbox-bar { position: absolute; top: 18px; left: 0; right: 0; display: flex; justify-content: center; color: #fff; font-size: 12px; gap: 14px; opacity: .85; }
.air-lightbox-close { position: absolute; top: 14px; right: 20px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); background: rgba(255,255,255,.12); color: #fff; display: grid; place-items: center; cursor: pointer; }
@media (max-width: 980px) {
  .air-side { position: absolute; z-index: 25; top: 0; bottom: 0; left: 0; box-shadow: 18px 0 50px rgba(0,0,0,.14); }
  .air-page-grid { grid-template-columns: minmax(0, 1fr); }
  .air-visual-wrap { position: static; }
  .air-brand-sub { display: none; }
}
`

    // ---------- tiny DOM helpers ----------
    const SVG_NS = 'http://www.w3.org/2000/svg'
    function h(tag, attrs, ...children) {
      const node = document.createElement(tag)
      applyAttrs(node, attrs)
      append(node, children)
      return node
    }
    function svg(tag, attrs, ...children) {
      const node = document.createElementNS(SVG_NS, tag)
      if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
          if (value === undefined || value === null) continue
          node.setAttribute(key, String(value))
        }
      }
      for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined) continue
        node.append(child && child.nodeType ? child : document.createTextNode(String(child)))
      }
      return node
    }
    function applyAttrs(node, attrs) {
      if (!attrs) return
      for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue
        if (key === 'class') node.className = value
        else if (key === 'text') node.textContent = value
        else if (key === 'html') node.innerHTML = value
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value)
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value)
        else if (key === 'dataset' && typeof value === 'object') Object.assign(node.dataset, value)
        else node.setAttribute(key, value === true ? '' : String(value))
      }
    }
    function append(node, children) {
      for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue
        node.append(child && child.nodeType ? child : document.createTextNode(String(child)))
      }
    }
    function icon(name, size = 18) {
      const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
      if (name === 'book') return svg('svg', common,
        svg('path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z' }),
        svg('path', { d: 'M4 17.5A2.5 2.5 0 0 1 6.5 15H20' }))
      if (name === 'bookmark') return svg('svg', common,
        svg('path', { d: 'M6 3h12v18l-6-4-6 4z' }))
      if (name === 'folder') return svg('svg', common,
        svg('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }))
      if (name === 'search') return svg('svg', common,
        svg('circle', { cx: 11, cy: 11, r: 7 }), svg('path', { d: 'm20 20-3.5-3.5' }))
      if (name === 'open') return svg('svg', common,
        svg('path', { d: 'M14 3h7v7' }), svg('path', { d: 'M10 14 21 3' }),
        svg('path', { d: 'M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5' }))
      if (name === 'left') return svg('svg', common, svg('path', { d: 'm15 18-6-6 6-6' }))
      if (name === 'right') return svg('svg', common, svg('path', { d: 'm9 18 6-6-6-6' }))
      if (name === 'panel') return svg('svg', common,
        svg('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), svg('path', { d: 'M9 4v16' }))
      if (name === 'refresh') return svg('svg', common,
        svg('path', { d: 'M20 7v5h-5' }), svg('path', { d: 'M4 17v-5h5' }),
        svg('path', { d: 'M6.1 9A7 7 0 0 1 19 8l1 4' }), svg('path', { d: 'M17.9 15A7 7 0 0 1 5 16l-1-4' }))
      if (name === 'copy') return svg('svg', common,
        svg('rect', { x: 9, y: 9, width: 12, height: 12, rx: 2 }), svg('path', { d: 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' }))
      if (name === 'close') return svg('svg', common, svg('path', { d: 'M6 6l12 12M18 6 6 18' }))
      return svg('svg', common, svg('circle', { cx: 12, cy: 12, r: 9 }))
    }

    function fmtSize(bytes) {
      if (!bytes) return ''
      if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
      return Math.max(1, Math.round(bytes / 1024)) + ' KB'
    }
    function fmtTime(ms) {
      if (!ms) return ''
      const d = new Date(ms)
      return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }

    async function apiFetch(path, options) {
      const response = await fetch(API + path, options)
      let value = null
      try { value = await response.json() } catch { /* ignore */ }
      if (!response.ok) throw new Error(value?.error || `请求失败（${response.status}）`)
      return value
    }

    const TRANSLATABLE = new Set(['body', 'heading', 'caption'])
    function translatableBlocks(page) {
      return (page?.blocks || []).filter((b) =>
        b && TRANSLATABLE.has(b.role) && typeof b.text === 'string' && b.text.trim().length > 1
        && !(b.role === 'body' && b.text.trim().length < 12))
    }

    class Reader {
      constructor(root) {
        this.root = root
        this.doc = null
        this.config = null
        this.library = []
        this.recent = []
        this.sideTab = 'recent'
        this.query = ''
        this.mode = 'compare'
        this.target = 'zh'
        this.style = 'academic'
        this.auto = true
        this.txtOnly = false
        this.pageStatus = {}
        this.translations = {}
        this.pendingTranslations = new Set()
        this.pageEls = new Map()
        this.pageImages = new Map()
        this.pageObjects = new Map()
        this.activePage = 1
        this.activeRaf = 0
        this.disposed = false
        this.toastTimer = null
        this.observer = null
        this.mount()
      }

      mount() {
        this.root.innerHTML = ''
        const style = document.createElement('style')
        style.textContent = CSS
        this.root.append(style)
        this.shell = h('div', { class: 'air-root' })
        this.root.append(this.shell)

        const head = h('header', { class: 'air-head' },
          h('div', { class: 'air-brand' },
            h('div', { class: 'air-brand-mark' }, icon('book', 16)),
            h('div', { class: 'air-brand-name' }, 'AI 阅读'),
            h('div', { class: 'air-brand-sub' }, '论文对照阅读器'),
          ),
          h('div', { class: 'air-head-spacer' }),
          h('div', { class: 'air-tools' },
            h('button', { class: 'air-btn primary', 'data-act': 'open' }, icon('open', 15), '打开 PDF'),
            h('div', { class: 'air-seg', role: 'tablist' },
              h('button', { 'data-mode': 'compare', class: 'on' }, '对照'),
              h('button', { 'data-mode': 'immerse' }, '沉浸'),
              h('button', { 'data-mode': 'original' }, '原文'),
            ),
            h('label', { class: 'air-field' }, '译成',
              h('select', { 'data-target': '' },
                h('option', { value: 'zh' }, '中文'),
                h('option', { value: 'en' }, 'English'),
              )),
            h('label', { class: 'air-field' }, '风格',
              h('select', { 'data-style': '' },
                h('option', { value: 'academic' }, '学术'),
                h('option', { value: 'literal' }, '直译'),
                h('option', { value: 'plain' }, '通俗'),
              )),
            h('button', { class: 'air-btn ghost', 'data-act': 'sidebar', title: '文档列表' }, icon('panel', 17)),
          ),
        )

        const side = h('aside', { class: 'air-side' },
          h('div', { class: 'air-side-head' }, h('div', { class: 'air-side-title' }, '文档')),
          h('div', { class: 'air-side-tabs' },
            h('button', { 'data-side-tab': 'recent', class: 'on' }, '最近'),
            h('button', { 'data-side-tab': 'workspace' }, '工作区'),
          ),
          h('div', { class: 'air-search' }, icon('search', 15), h('input', { placeholder: '搜索论文…', 'data-search': '' })),
          h('div', { class: 'air-doclist', 'data-doclist': '' }),
          h('div', { class: 'air-side-foot' }, '也可以把 PDF 直接拖进右侧阅读区。'),
        )

        const main = h('main', { class: 'air-main' },
          h('div', { class: 'air-empty' },
            h('div', { class: 'air-empty-card' },
              h('div', { class: 'air-empty-icon' }, icon('book', 38)),
              h('h2', {}, '把论文放进来，边读边译'),
              h('p', {}, '打开一篇 PDF，AI 会按页翻译成中文。对照模式左侧保留原始版面，右侧逐段中英对照；沉浸模式把译文直接覆盖在原文位置上。'),
              h('div', { class: 'air-empty-actions' },
                h('button', { class: 'air-btn primary', 'data-act': 'open' }, icon('open', 15), '选择 PDF'),
                h('button', { class: 'air-btn', 'data-act': 'workspace' }, icon('folder', 15), '从工作区选择'),
              ),
              h('div', { class: 'air-drop' }, '拖拽 PDF 到这里即可打开'),
            ),
          ),
          h('div', { class: 'air-scroll', 'data-scroll': '' }),
        )

        const foot = h('footer', { class: 'air-foot' },
          h('span', { 'data-foot-left': '' }, '就绪'),
          h('span', { class: 'grow' }),
          h('label', {},
            h('input', { type: 'checkbox', 'data-auto': '', checked: true }),
            '自动翻译可见页',
          ),
          h('span', { 'data-foot-model': '' }, ''),
        )

        const toast = h('div', { class: 'air-toast', 'data-toast': '' })
        this.shell.append(head, h('div', { class: 'air-body' }, side, main), foot, toast)
        this.el = {
          scroll: this.shell.querySelector('[data-scroll]'),
          doclist: this.shell.querySelector('[data-doclist]'),
          toast: this.shell.querySelector('[data-toast]'),
          footLeft: this.shell.querySelector('[data-foot-left]'),
          footModel: this.shell.querySelector('[data-foot-model]'),
          search: this.shell.querySelector('[data-search]'),
          loading: null,
        }

        this.fileInput = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: { display: 'none' } })
        this.shell.append(this.fileInput)

        this.bind()
        this.loadConfig()
        this.loadLibrary()
      }

      bind() {
        this.shell.addEventListener('click', (event) => {
          const target = event.target.closest('[data-act],[data-mode],[data-side-tab],[data-open-path],[data-open-id],[data-goto],[data-retranslate]')
          if (!target) return
          if (target.dataset.act === 'open') this.fileInput.click()
          else if (target.dataset.act === 'sidebar') this.shell.classList.toggle('side-closed')
          else if (target.dataset.act === 'workspace') this.switchSideTab('workspace')
          else if (target.dataset.mode) this.setMode(target.dataset.mode)
          else if (target.dataset.sideTab) this.switchSideTab(target.dataset.sideTab)
          else if (target.dataset.openPath) this.openPath(target.dataset.openPath)
          else if (target.dataset.openId) this.openRecent(target.dataset.openId)
          else if (target.dataset.goto) this.scrollToPage(Number(target.dataset.goto))
          else if (target.dataset.retranslate) this.ensureTranslation(Number(target.dataset.retranslate), true)
        })
        this.fileInput.addEventListener('change', () => {
          const file = this.fileInput.files?.[0]
          if (file) this.upload(file)
          this.fileInput.value = ''
        })
        this.el.scroll.addEventListener('scroll', () => this.scheduleActivePage(), { passive: true })
        this.shell.querySelector('[data-target]').addEventListener('change', (event) => {
          this.target = event.target.value
          this.resetTranslations()
        })
        this.shell.querySelector('[data-style]').addEventListener('change', (event) => {
          this.style = event.target.value
          this.resetTranslations()
        })
        this.shell.querySelector('[data-auto]').addEventListener('change', (event) => {
          this.auto = event.target.checked
          if (this.auto) this.ensureVisibleTranslations()
        })
        this.el.search.addEventListener('input', (event) => {
          this.query = event.target.value.trim().toLowerCase()
          this.renderDocList()
        })
        this.shell.addEventListener('dragover', (event) => {
          event.preventDefault()
          this.shell.classList.add('drag-over')
        })
        this.shell.addEventListener('dragleave', () => this.shell.classList.remove('drag-over'))
        this.shell.addEventListener('drop', (event) => {
          event.preventDefault()
          this.shell.classList.remove('drag-over')
          const file = Array.from(event.dataTransfer?.files || []).find((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
          if (file) this.upload(file)
        })
      }

      async loadConfig() {
        try {
          const config = await apiFetch('/config')
          this.config = config
          const model = config.providers?.[0]?.models?.[0]?.id || ''
          this.el.footModel.textContent = model ? `模型 ${model}` : ''
        } catch (error) {
          this.toast(String(error.message || error), true)
        }
      }

      async loadLibrary() {
        try {
          const [recent, lib] = await Promise.all([
            apiFetch('/recent').catch(() => ({ files: [] })),
            apiFetch('/library').catch(() => ({ files: [] })),
          ])
          this.recent = recent.files || []
          this.library = lib.files || []
          this.renderDocList()
        } catch (error) {
          this.toast(String(error.message || error), true)
        }
      }

      switchSideTab(tab) {
        this.sideTab = tab
        for (const button of this.shell.querySelectorAll('[data-side-tab]')) {
          button.classList.toggle('on', button.dataset.sideTab === tab)
        }
        this.renderDocList()
        if (tab === 'workspace') this.loadLibrary()
      }

      renderDocList() {
        const list = this.el.doclist
        list.innerHTML = ''
        const query = this.query
        if (this.sideTab === 'recent') {
          const rows = this.recent.filter((row) => !query || `${row.title} ${row.path}`.toLowerCase().includes(query))
          if (rows.length === 0) {
            list.append(h('div', { class: 'air-side-empty' }, '还没有打开过论文。点击「打开 PDF」或从工作区选择一篇。'))
            return
          }
          for (const row of rows) {
            list.append(this.docRow(row.title || row.path, `${row.pageCount || '?'} 页 · ${fmtTime(row.openedAt)}`, () => this.openRecent(row.id), row.id === this.doc?.id, () => row.path))
          }
          return
        }
        const rows = this.library.filter((row) => !query || `${row.rel} ${row.name}`.toLowerCase().includes(query))
        if (rows.length === 0) {
          list.append(h('div', { class: 'air-side-empty' }, '工作区里还没有找到 PDF。你仍然可以用「打开 PDF」选择任意文件。'))
          return
        }
        for (const row of rows) {
          const item = this.docRow(row.name, `${row.rel} · ${fmtSize(row.size)}`, () => this.openPath(row.path), this.doc?.path === row.path)
          item.title = row.path
          list.append(item)
        }
      }

      docRow(title, meta, onClick, active, titleAttr) {
        const row = h('div', { class: `air-doc-row${active ? ' on' : ''}`, onclick: onClick, title: titleAttr || title },
          icon('book', 16),
          h('div', { class: 'air-doc-main' },
            h('div', { class: 'air-doc-name' }, title),
            h('div', { class: 'air-doc-meta' }, meta),
          ),
        )
        return row
      }

      async openRecent(id) {
        const row = this.recent.find((item) => item.id === id)
        if (!row) return
        if (this.doc?.id === id) return
        await this.openPath(row.path)
      }

      async openPath(path) {
        try {
          this.showLoading('正在解析 PDF…', '提取文本与版面坐标')
          const doc = await apiFetch('/open', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }),
          })
          this.setDoc(doc)
        } catch (error) {
          this.toast(String(error.message || error), true)
          this.hideLoading()
        }
      }

      async upload(file) {
        try {
          this.showLoading('正在上传并解析 PDF…', file.name)
          const buffer = await file.arrayBuffer()
          const response = await fetch(`${API}/upload?name=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/pdf', 'x-filename': encodeURIComponent(file.name) },
            body: buffer,
          })
          const value = await response.json().catch(() => null)
          if (!response.ok) throw new Error(value?.error || `上传失败（${response.status}）`)
          this.setDoc(value)
        } catch (error) {
          this.toast(String(error.message || error), true)
          this.hideLoading()
        }
      }

      setDoc(doc) {
        this.doc = doc
        this.pageStatus = {}
        this.translations = {}
        this.pendingTranslations.clear()
        this.pageEls.clear()
        for (const url of this.pageObjects.values()) URL.revokeObjectURL(url)
        this.pageObjects.clear()
        this.pageImages.clear()
        this.shell.classList.add('has-doc')
        this.el.scroll.innerHTML = ''
        this.renderDocHead()
        this.renderPages()
        this.loadLibrary()
        this.setMode(this.mode)
        this.hideLoading()
        this.el.scroll.scrollTop = 0
        this.setActivePage(1)
        this.el.footLeft.textContent = `${doc.pageCount} 页 · 已打开`
      }

      renderDocHead() {
        const doc = this.doc
        const head = h('div', { class: 'air-doc-head' },
          h('h1', { class: 'air-doc-title' }, doc.title || '未命名论文'),
          h('div', { class: 'air-doc-sub' },
            h('span', {}, `${doc.pageCount} 页`),
            h('span', {}, doc.path || ''),
          ),
          doc.outline?.length ? h('div', { class: 'air-outline' },
            doc.outline.filter((item) => item.level <= 2).slice(0, 14).map((item) =>
              h('button', { 'data-goto': item.page, title: item.title }, item.title)),
          ) : null,
        )
        this.el.scroll.append(head)
      }

      renderPages() {
        if (this.observer) this.observer.disconnect()
        this.observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const page = Number(entry.target.dataset.page)
            this.loadPageImage(page)
            if (this.auto) this.ensureTranslation(page)
          }
        }, { root: this.el.scroll, rootMargin: '700px 0px' })
        for (const page of this.doc.pages) {
          const section = h('section', { class: 'air-page', 'data-page': page.page })
          const chip = h('span', { class: 'air-chip', 'data-chip': page.page }, '待翻译')
          const blockToggle = h('button', { class: 'air-btn ghost', style: { height: '26px', padding: '0 8px', fontSize: '11px' }, 'data-txt-toggle': '' }, '仅译文')
          blockToggle.addEventListener('click', () => {
            this.txtOnly = !this.txtOnly
            this.shell.classList.toggle('txt-only', this.txtOnly)
            blockToggle.textContent = this.txtOnly ? '双语' : '仅译文'
          })
          const header = h('div', { class: 'air-page-head' },
            h('span', { class: 'air-page-no' }, `Page ${page.page}`),
            chip,
            h('span', { class: 'air-page-spacer' }),
            h('button', { class: 'air-btn ghost', style: { height: '26px', padding: '0 8px', fontSize: '11px' }, 'data-retranslate': page.page, title: '重新翻译本页' }, icon('refresh', 13), '重译'),
            blockToggle,
          )
          const image = h('img', { alt: `第 ${page.page} 页` })
          const loading = h('div', { class: 'air-visual-loading' }, '加载页面…')
          const visual = h('div', { class: 'air-visual', style: { aspectRatio: `${page.width} / ${page.height}` } }, image, loading)
          const overlay = h('div', { class: 'air-overlay-layer' })
          visual.append(overlay)
          const blocks = h('div', { class: 'air-blocks' })
          const grid = h('div', { class: 'air-page-grid' },
            h('div', { class: 'air-visual-wrap' }, visual),
            blocks,
          )
          section.append(header, grid)
          this.el.scroll.append(section)
          this.pageEls.set(page.page, { section, image, loading, overlay, blocks, chip })
          this.renderBlocks(page)
          this.observer.observe(section)
          image.addEventListener('load', () => { loading.style.display = 'none'; this.updateOverlay(page.page) })
          image.addEventListener('error', () => { loading.textContent = '页面加载失败' })
          image.addEventListener('click', () => this.openLightbox(page.page))
        }
      }

      renderBlocks(page) {
        const holder = this.pageEls.get(page.page)?.blocks
        if (!holder) return
        holder.innerHTML = ''
        const blocks = translatableBlocks(page)
        if (blocks.length === 0) {
          holder.append(h('div', { class: 'air-side-empty' }, '这一页主要是图表或公式，没有可翻译的正文段落。'))
          return
        }
        for (const block of blocks) {
          const orig = h('div', { class: 'air-block-orig' }, block.text)
          const zh = h('div', { class: 'air-block-zh' }, h('span', { class: 'air-wait' }, '待翻译'))
          const row = h('div', { class: `air-block ${block.role}` }, orig, zh)
          row.dataset.block = block.id
          row.dataset.page = String(page.page)
          holder.append(row)
        }
        this.updateBlockTranslations(page.page)
      }

      updateBlockTranslations(pageNumber) {
        const page = this.doc?.pages[pageNumber - 1]
        const holder = this.pageEls.get(pageNumber)?.blocks
        if (!page || !holder) return
        const map = this.translations[pageNumber] || {}
        const status = this.pageStatus[pageNumber] || 'idle'
        for (const block of translatableBlocks(page)) {
          const row = holder.querySelector(`[data-block="${block.id}"]`)
          if (!row) continue
          const zh = row.querySelector('.air-block-zh')
          if (!zh) continue
          if (map[block.id]) {
            zh.textContent = map[block.id]
          } else if (status === 'loading') {
            zh.innerHTML = ''
            zh.append(h('span', { class: 'air-skel' }))
          } else if (status === 'error') {
            zh.innerHTML = ''
            zh.append(h('span', { class: 'air-wait' }, '翻译失败，可点击「重译」'))
          } else {
            zh.innerHTML = ''
            zh.append(h('span', { class: 'air-wait' }, '待翻译'))
          }
        }
        this.updateOverlay(pageNumber)
      }

      updateOverlay(pageNumber) {
        const entry = this.pageEls.get(pageNumber)
        if (!entry) return
        const page = this.doc?.pages[pageNumber - 1]
        if (!page) return
        const map = this.translations[pageNumber] || {}
        entry.overlay.innerHTML = ''
        for (const block of translatableBlocks(page)) {
          const text = map[block.id]
          if (!text) continue
          const [x0, y0, x1, y1] = block.bbox
          const card = h('div', {
            class: `air-overlay ${block.role}`,
            title: block.text,
            style: {
              left: `${(x0 / page.width) * 100}%`,
              top: `${(y0 / page.height) * 100}%`,
              width: `${((x1 - x0) / page.width) * 100}%`,
              minHeight: `${((y1 - y0) / page.height) * 100}%`,
            },
          }, text)
          entry.overlay.append(card)
          this.fitOverlay(card, page, block)
        }
      }

      fitOverlay(card, page, block) {
        const width = (block.bbox[2] - block.bbox[0]) / page.width * (this.pageEls.get(page.page)?.image.clientWidth || 700)
        const height = (block.bbox[3] - block.bbox[1]) / page.height * (this.pageEls.get(page.page)?.image.clientHeight || 900)
        let size = Math.max(6, Math.min(12.5, block.fontSize || 10))
        card.style.fontSize = `${size}px`
        let guard = 0
        while (guard++ < 40 && (card.scrollHeight > Math.max(height, 14) + 1 || card.scrollWidth > Math.max(width, 20) + 1) && size > 5.2) {
          size -= 0.35
          card.style.fontSize = `${size.toFixed(2)}px`
        }
      }

      openLightbox(pageNumber) {
        const url = this.pageObjects.get(pageNumber)
        if (!url) return
        const box = h('div', { class: 'air-lightbox' },
          h('div', { class: 'air-lightbox-bar' }, `${this.doc?.title || ''} · 第 ${pageNumber} 页`),
          h('button', { class: 'air-lightbox-close', title: '关闭', onclick: () => box.remove() }, icon('close', 17)),
          h('img', { src: url, alt: `第 ${pageNumber} 页` }),
        )
        box.addEventListener('click', (event) => { if (event.target === box) box.remove() })
        const onKey = (event) => { if (event.key === 'Escape') { box.remove(); window.removeEventListener('keydown', onKey) } }
        window.addEventListener('keydown', onKey)
        this.shell.append(box)
      }

      async loadPageImage(pageNumber) {
        if (this.pageObjects.has(pageNumber)) return
        const entry = this.pageEls.get(pageNumber)
        if (!entry) return
        const pending = (async () => {
          const response = await fetch(`${API}/page?id=${encodeURIComponent(this.doc.id)}&page=${pageNumber}&zoom=2`)
          if (!response.ok) throw new Error(`页面加载失败（${response.status}）`)
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          this.pageObjects.set(pageNumber, url)
          entry.image.src = url
        })()
        this.pageImages.set(pageNumber, pending)
        try { await pending } catch (error) { entry.loading.textContent = String(error.message || error) }
      }

      setActivePage(page) {
        this.activePage = page
        this.el.footLeft.textContent = `${this.doc?.pageCount || 0} 页 · 正在阅读第 ${page} 页`
      }

      scheduleActivePage() {
        if (this.activeRaf) return
        this.activeRaf = requestAnimationFrame(() => {
          this.activeRaf = 0
          if (!this.doc || this.disposed) return
          const scrollRect = this.el.scroll.getBoundingClientRect()
          const anchor = scrollRect.top + 110
          let candidate = this.activePage
          for (const [pageNumber, entry] of this.pageEls) {
            const rect = entry.section.getBoundingClientRect()
            if (rect.top <= anchor) candidate = pageNumber
            else break
          }
          if (candidate !== this.activePage) {
            this.setActivePage(candidate)
            if (this.auto) this.ensureTranslation(candidate)
          }
        })
      }

      scrollToPage(page) {
        const entry = this.pageEls.get(page)
        if (entry) entry.section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      ensureVisibleTranslations() {
        const page = this.activePage
        for (let offset = 0; offset <= 1; offset++) {
          for (const candidate of [page + offset, page - offset]) {
            if (candidate >= 1 && candidate <= (this.doc?.pageCount || 0)) this.ensureTranslation(candidate)
          }
        }
      }

      async ensureTranslation(pageNumber, force = false) {
        if (!this.doc) return
        const status = this.pageStatus[pageNumber]
        if (!force && (status === 'loading' || status === 'done')) return
        if (!force && !this.auto) return
        if (!force && this.pendingTranslations.size >= 3) return
        if (force) {
          this.translations[pageNumber] = {}
          this.updateBlockTranslations(pageNumber)
        }
        this.pendingTranslations.add(pageNumber)
        this.pageStatus[pageNumber] = 'loading'
        this.updateChip(pageNumber)
        this.updateBlockTranslations(pageNumber)
        try {
          const result = await apiFetch('/translate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: this.doc.id, page: pageNumber, target: this.target, style: this.style, force,
            }),
          })
          this.translations[pageNumber] = { ...(this.translations[pageNumber] || {}), ...(result.translations || {}) }
          this.pageStatus[pageNumber] = 'done'
          if (result.failures?.length) {
            this.toast(`第 ${pageNumber} 页有 ${result.failures.length} 段未译出，可点「重译」重试`, true)
          }
          this.updateChip(pageNumber)
          this.updateBlockTranslations(pageNumber)
          if (this.auto && !this.disposed && pageNumber === this.activePage && pageNumber < this.doc.pageCount) {
            setTimeout(() => {
              if (!this.disposed && this.auto) this.ensureTranslation(pageNumber + 1)
            }, 300)
          }
        } catch (error) {
          this.pageStatus[pageNumber] = 'error'
          this.updateChip(pageNumber)
          this.updateBlockTranslations(pageNumber)
          this.toast(String(error.message || error), true)
        } finally {
          this.pendingTranslations.delete(pageNumber)
        }
      }

      updateChip(pageNumber) {
        const chip = this.pageEls.get(pageNumber)?.chip
        if (!chip) return
        const status = this.pageStatus[pageNumber] || 'idle'
        chip.className = `air-chip ${status === 'idle' ? '' : status}`
        chip.textContent = status === 'loading' ? '翻译中…' : status === 'done' ? '已翻译' : status === 'error' ? '翻译失败' : '待翻译'
      }

      resetTranslations() {
        this.translations = {}
        this.pageStatus = {}
        for (const pageNumber of this.pageEls.keys()) {
          this.updateChip(pageNumber)
          this.updateBlockTranslations(pageNumber)
        }
        this.ensureVisibleTranslations()
      }

      setMode(mode) {
        this.mode = mode
        this.shell.classList.remove('mode-compare', 'mode-immerse', 'mode-original')
        this.shell.classList.add(`mode-${mode}`)
        for (const button of this.shell.querySelectorAll('[data-mode]')) {
          button.classList.toggle('on', button.dataset.mode === mode)
        }
        if (mode !== 'original') this.ensureVisibleTranslations()
        if (mode === 'immerse') {
          for (const page of this.pageEls.keys()) this.updateOverlay(page)
        }
      }

      showLoading(title, subtitle) {
        this.hideLoading()
        const mask = h('div', { class: 'air-loading-mask' },
          h('div', { class: 'air-loading-card' },
            h('div', { class: 'air-spinner' }),
            h('div', { style: { fontWeight: 600, fontSize: '14px' } }, title),
            subtitle ? h('div', { style: { color: 'var(--air-faint)', fontSize: '11.5px', marginTop: 6 } }, subtitle) : null,
          ),
        )
        this.el.loading = mask
        this.shell.append(mask)
      }

      hideLoading() {
        if (this.el.loading) this.el.loading.remove()
        this.el.loading = null
      }

      toast(message, bad = false) {
        const node = this.el.toast
        node.textContent = message
        node.className = `air-toast show${bad ? ' bad' : ''}`
        clearTimeout(this.toastTimer)
        this.toastTimer = setTimeout(() => { node.className = 'air-toast' }, 4200)
      }

      dispose() {
        this.disposed = true
        if (this.activeRaf) cancelAnimationFrame(this.activeRaf)
        this.pendingTranslations.clear()
        if (this.observer) this.observer.disconnect()
        for (const url of this.pageObjects.values()) URL.revokeObjectURL(url)
        this.pageObjects.clear()
        this.shell.remove()
      }
    }

    const inject = ['slots', 'locale', 'layout']

    function AIReaderPanel() {
      const ref = React.useRef(null)
      React.useEffect(() => {
        const reader = new Reader(ref.current)
        if (typeof window !== 'undefined') window.__aiReader = reader
        return () => reader.dispose()
      }, [])
      return React.createElement('div', { ref, className: 'air-host' })
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register('aiReader', {
        zh: { panel: 'AI 阅读' },
        en: { panel: 'AI Reader' },
      }), 'dsh-ai-reader: locale')
      const t = ctx.locale.bind('aiReader')

      const PanelIcon = () => React.createElement('span', {
        style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
        dangerouslySetInnerHTML: {
          __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/></svg>',
        },
      })

      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: 'ai-reader', order: 35,
        label: () => t('panel'), locale: 'aiReader',
      }, PanelIcon)), 'dsh-ai-reader: sidebar')

      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main', key: 'ai-reader', locale: 'aiReader',
      }, AIReaderPanel)), 'dsh-ai-reader: main')
    }

    exports.inject = inject
    exports.apply = apply
    exports.__dev = { Reader }
    return module.exports
  },
})
