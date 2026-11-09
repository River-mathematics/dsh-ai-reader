# DSH AI Reader

> 在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）里读论文：打开 PDF，按页翻译，左侧保留原始版面，右侧逐段中英对照；也可以把译文直接覆盖在原文位置上。

An AI reading plugin for DeepSeek Harness: open a PDF, translate it page by page, and read it in a bilingual side-by-side or immersive overlay view.

![对照模式](docs/preview-compare.png)

![右侧栏模式](docs/preview-sidebar.png)

![沉浸模式](docs/preview-immersive.png)

## 功能

- **对照阅读**：左侧原始 PDF 页面，右侧逐段「英文原文 + 中文译文」。
- **沉浸翻译**：译文按段落 bbox 覆盖到 PDF 页面上，保留图表、公式和排版位置。
- **原文模式**：只看 PDF 页面。
- **聊天内嵌 / 右侧栏**：在输入框附件里出现「AI 阅读」按钮，点击后阅读器在右侧栏打开，聊天自动压缩到左侧；返回对话不需要离开页面。
- **最近文档管理**：重命名、从最近移除、删除本地缓存、清空最近；工作区原 PDF 不会被删除。
- **段落引用**：每段「引用」可把原文/译文插入当前对话输入框。
- 支持译成中文 / English，翻译风格：学术 / 直译 / 通俗。
- **模型选择**：可在 `deepseek-flash` / `deepseek-v4-pro` 之间切换。
- **术语表**：每行 `原文=译文`，保存后按术语重译；缓存按术语表哈希区分。
- **文内搜索**：搜索原文/译文并跳转到对应段落。
- **页面缩放**：100%–250%，查看公式和表格细节。
- **中英对照导出**：把当前文档已翻译内容导出为 Markdown。
- 自动翻译可见页、页级重译、段落级缓存（同一段不重复请求）。
- 深色 / 浅色主题适配 DSH。
- 不需要单独填写 API Key：翻译通过 DSH 已登录的模型服务（`ctx.llm`）完成。
- 页面图可点击放大，方便看公式、表格和 figure。

## 环境要求

| 组件 | 版本 |
|---|---|
| DSH Desktop | 0.2.x（在 0.2.1-rc.5 上测试） |
| Python | 3.10+，`python` 需要在 PATH 中 |
| PyMuPDF | 1.24–1.x（在 1.28.2 上测试） |

不需要 Node.js 构建：仓库里的 `client.js` 是可直接加载的客户端 bundle。

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/River-mathematics/dsh-ai-reader.git
cd dsh-ai-reader
```

### 2. 安装 Python 依赖

```bash
python -m pip install -r worker/requirements.txt
```

### 3. 安装到 DSH profile

用本地路径安装（推荐）：

```bash
dsh plugin --profile desktop add link:<本仓库绝对路径>
```

或者直接从 GitHub 安装：

```bash
dsh plugin --profile desktop add https://github.com/River-mathematics/dsh-ai-reader
```

安装后重启 DSH，或在「插件」页启用 `dsh-ai-reader`。如果只安装了依赖但没有进入 bundle 层，把 `dsh-ai-reader` 加入 profile 的 `dsh.profile.bundles`：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-ai-reader"]
    }
  }
}
```

也可以手动在 `~/.dsh/profiles/desktop/cordis.patch.yml` 增加：

```yaml
- insert:
    - id: ai-reader
      name: dsh-ai-reader
```

> 注意：走 bundle 层时不要再保留同 id 的 insert 行，否则加载器会因为重复 id 启动失败。

### 4. 验证

刷新 DSH 页面，左侧栏出现「AI 阅读」。打开任意文本型 PDF，第 1 页会自动开始翻译。

## 使用

### 全屏阅读

1. 点击左侧栏「AI 阅读」。
2. 「打开 PDF」选择文件，或从工作区列表选择，也可以直接拖拽 PDF 到阅读区。
3. 默认自动翻译当前页；右上角切换「对照 / 沉浸 / 原文」、目标语言和翻译风格。
4. 每页有「重译」和「− 100% +」缩放；点击页面图可放大查看公式和图表。
5. 关闭再打开同一篇论文会命中段落缓存，基本秒开。

### 边聊天边读

1. 在对话输入框附加一篇 PDF（拖拽或点文件按钮）。
2. 输入框工具栏会出现「AI 阅读」按钮，点击后阅读器在右侧栏打开，聊天自动压缩到左侧。
3. 右侧栏可以继续切换对照/沉浸、模型、术语表、搜索和导出。
4. 每段右侧的「引用」会把原文/译文插入当前对话输入框，不会自动发送。

### 最近文档

- 最近列表每行右侧 `⋯` 可以重命名、从最近移除、删除本地缓存。
- 「清空」会清空最近列表并删除这些文档的页面图/译文缓存。
- 工作区原 PDF 永不被删除；上传的 PDF 副本会随缓存一起删除。
- 上传标题现在优先使用原文件名；历史 hash 标题可以用「重命名」修正。

## 工作原理

```text
client.js（DSH Web GUI）
  ├─ 左侧栏入口 + main 全屏面板
  ├─ 右侧栏 tab（sidebarRightTabs / sidebar.right.pane.tab）
  ├─ 输入框附件按钮（conversation.input.right）
  ├─ PDF 页面图 + 段落 bbox 覆盖
  └─ /api/ai-reader/*（浏览器 webServer + 桌面 shell fetch route）
        │
        ├─ host.js：打开/上传/最近管理/页面图/翻译
        │    ├─ worker/main.py（PyMuPDF）：段落提取 + 页面 PNG
        │    └─ ctx.llm.stream()：调用 DSH 当前账号可用的模型
        │
        └─ ~/.dsh/cache/ai-reader/：文档、页面图、翻译缓存
```

- 段落按 PyMuPDF 的 block/column 信息提取，过滤页眉页脚、图表标签和公式碎片。
- 翻译按批（≤5 段/批）并发请求，返回后按 block id 合并；缓存键包含模型和术语表哈希。
- 页面图由 PyMuPDF 按 2x 渲染，滚动到附近才加载。
- 右侧栏 tab 使用 DSH 原生 `keepMounted`，切换 tab 时保留文档和译文状态。

## 目录结构

```text
index.js                宿主入口（薄加载层）
host.js                 HTTP 路由与翻译编排
client.js               DSH 客户端插件 bundle
worker/main.py          PyMuPDF 提取/渲染 worker
worker/requirements.txt Python 依赖
cordis.patch.yml        DSH bundle patch
docs/                   README 截图
```

## 缓存与隐私

- 文档、页面图和译文缓存位于 `~/.dsh/cache/ai-reader/`，删除该目录即可清空。
- 插件本身不保存 API Key；翻译使用 DSH 的登录态和模型服务。
- 路由只注册在本机 DSH 进程内（`webServer` / 桌面 shell carrier），不会额外起公网端口。
- 公开截图中的本地文件路径已做脱敏处理。

## 已知限制

- **仅文本型 PDF**：扫描版没有文本层，暂不支持 OCR。
- **公式**：复杂公式可能被拆成多个文本块；这些块会跳过翻译，但原文仍显示在页面图上。
- **表格**：当前以页面图为准，不逐单元格翻译。
- **延迟**：首次打开一页通常需要几秒（取决于模型）；命中缓存后很快。
- **翻译质量**：取决于 DSH 当前账号可用的模型；可以在阅读器里切换 `deepseek-flash` / `deepseek-v4-pro`，或改 `host.js` 的 provider/model 选择逻辑。
- **右侧栏是 Session 级的**：切换对话 Session 时阅读器 tab 不会跟随；打开同一 Session 会保留。需要跨 Session 时可使用左侧栏的全屏阅读。
- **导出范围**：Markdown 导出包含当前文档所有已翻译段落；未翻译段落只保留原文。暂不支持导出 PDF。
- **引用到对话**：插入当前输入框光标位置；如果编辑器不可写，会退化为复制到剪贴板。

> PyMuPDF 由用户通过 `worker/requirements.txt` 单独安装，遵循其 AGPL / 商业许可；本仓库不打包 PyMuPDF。

## 开发

```bash
# 语法检查
node --check index.js
node --check host.js
node --check client.js

# Python worker 编译检查
python -m py_compile worker/main.py
```

客户端是手写的 CJS 风格 bundle，外层包装为 `window.__ModuleLoader__.load(...)`；修改 `client.js` 后刷新 DSH 页面即可加载新 bundle。宿主侧 `index.js` 通过带时间戳的动态 import 加载 `host.js`，便于在开发时通过插件重载更新路由。

## Roadmap

- [x] 右侧栏 / 聊天内嵌模式：附件出现「AI 阅读」按钮，点击后聊天压缩到左侧、阅读器在右侧。
- [x] 段落「引用到对话」，把原文/译文插入输入框。
- [x] 术语表 / 锁定译名（基础版）。
- [x] 模型选择器（`deepseek-flash` / `deepseek-v4-pro`）。
- [x] 文内搜索、页面缩放、段落高亮、Markdown 导出。
- [ ] 术语表 `locked` 语法与导入文件。
- [ ] 导出并排 PDF。
- [ ] 扫描版 OCR / 公式 LaTeX。

## License

[MIT](LICENSE)
