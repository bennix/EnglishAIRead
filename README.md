# Folio · AI 英文阅读工作台

基于 Electron + React 的本地英文外刊阅读软件，使用 ZenMux 的 OpenAI 兼容接口。

## 启动

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

打包当前平台的桌面应用：

```bash
npm run pack   # 可直接运行的应用目录，输出 release/
npm run dist   # 安装包：macOS DMG/ZIP、Windows NSIS、Linux AppImage/DEB/RPM
```

本机 macOS Apple Silicon DMG 位于 `release/Folio-mac-arm64.dmg`，DMG 内含 `Applications` 快捷方式，拖拽即可安装。应用已使用本机 Xcode Keychain 中的 Developer ID Application 证书签名；Apple Notary 公证需要在本机 `notarytool` Keychain Profile 或 GitHub Secrets 中提供 Apple ID、Team ID 和专用密码后提交，专用密码不会写入仓库。

`npm run dev:web` 仅用于浏览器界面预览。文件、安全存储和 AI 接口必须在 Electron 桌面版使用。

## 已实现

- **离线书架**：预下载 `awesome-english-ebooks` 中《经济学人》2026.09.12，内置 70 篇独立文章；另有一篇原创体验文章。原始 EPUB/MOBI 位于 `resources/`。
- **手动检查更新**：检查《经济学人》《纽约客》《大西洋月刊》《连线》的 GitHub 目录，浏览往期并下载 EPUB、MOBI、PDF。目录有本地缓存，离线时明确显示缓存状态。
- **按文章阅读**：EPUB 按 spine 正文顺序拆分，MOBI 按目录映射提取；书架按文章列出。PDF 先提取分页文字，选择文章页码范围并整理正文后保存为独立文章，可以继续摘选其他文章。
- **阅读器**：分页与连续阅读、上一页/下一页、方向键翻页、70%–180% 缩放、拖拽平移；保存页码、缩放和滚动位置。
- **阅读理解**：高考、四级、六级、托福、GRE 五档，每篇每档生成 5 道四选一题；全部作答后提交，显示得分与中文解析。
- **AI 判题与依据**：题目、正确答案、对错判断和每题中文原因均由当前选择的 ZenMux 模型基于当前文章生成；重新选择模型并出题即可获得对应模型的判断。提交后不可修改答案，避免边看解析边改分。
- **概要写作**：英文 100–200 词，实时计数、草稿自动保存、AI 评分与建议、100–200 词参考范文；修改草稿后会标明旧反馈。
- **手写作文判分**：概要写作可切换到手写模式，上传/粘贴/拖入 1–4 张照片并展示缩略图。AI 根据图片识别原稿，保留学生拼写和语法错误，展示识别词数与待核对字词；按内容 40、结构 20、语言 30、词数 10 分评分。参考范文和学生识别稿明确分开。无法可靠识别的照片不会评分，图片与反馈会持久保存并纳入历史导出。
- **AI 追问**：自动携带当前文章正文、对话上下文和所选附件；每条 AI 回答可复制。
- **附件**：图片 PNG/JPG/WEBP/GIF、PDF、Word `.docx`、Markdown、TXT。支持文件选择、拖入、剪贴板图片及 macOS 文件粘贴，图片展示缩略图。每条消息最多 4 个附件，单个最多 10 MB。文档抽取文字，图片走视觉输入。
- **划词与生词本**：仅阅读模式支持 AI 语境查词与收藏。练习模式清除查词弹窗并禁止查词请求。
- **历史记录**：按文章保存阅读位置、各难度练习、概要草稿与反馈、AI 对话。可全选/多选删除或导出 Markdown/JSON。删除历史不会删除文章。导出包含附件名称，JSON 同时保留图片缩略图。
- **设置**：API Key 在主进程通过 Electron `safeStorage` 加密后保存在本地；已保存密钥不返回前端。输入默认密码遮蔽，可显示本次输入内容；支持清除密钥、选择/添加/移除模型。

## ZenMux

固定接口地址：`https://zenmux.ai/api/v1`

内置模型：

- `anthropic/claude-sonnet-4.6`
- `anthropic/claude-sonnet-5`
- `z-ai/glm-5v-turbo`
- `openai/gpt-5.4`

没有 API Key 时，设置页面提供邀请链接：<https://zenmux.ai/invite/GBQMC5>。保存密钥后即可出题、点评和追问；是否支持图片由所选模型决定。

## 本地数据与架构

```text
electron/main.cjs         窗口、安全 IPC、设置、刊物下载与本地数据
electron/preload.cjs      受限的 renderer → main API
electron/core.cjs         EPUB 解析、模型提示词与输出验证
electron/books.cjs        MOBI / PDF 解析、PDF 选页摘文
electron/attachments.cjs   图片缩略图、PDF / DOCX / MD 附件
electron/study.cjs        AI 追问、查词、生词本、历史导出
src/main.jsx             React 界面与阅读/练习工作流
src/style.css            纸质杂志风格界面
```

使用 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。渲染进程不持有 API Key，也不直接读取任意本地路径；网络请求在主进程执行，外部链接使用固定白名单。正文及模型回答按文本显示，不执行书籍中的脚本。

持久化目录为 Electron `app.getPath('userData')`。开发版通常位于 macOS `~/Library/Application Support/folio-english-reader`，打包版位于 `~/Library/Application Support/Folio`；Windows/Linux 使用各自标准应用数据目录。包括加密设置、文章库、进度、生词本、附件和 PDF 导入资料。正常关闭或重启应用不会清除数据。

密钥依赖操作系统钥匙串/凭据服务；不提供明文降级存储。阅读正文、历史和附件是普通本地文件。只在用户主动使用 AI 时发送当前文章/附件至 ZenMux。

## 格式边界

- 这是 **正文重排阅读器**，不是 EPUB/MOBI/PDF 原版印刷排版查看器。
- 单本书籍导入/下载上限 40 MB。
- PDF 需有可提取的文字层；扫描 PDF 需先 OCR，或把页面作为图片附件交给视觉模型。多栏 PDF 的文字顺序可能需要在摘选界面整理。
- Word 支持 `.docx`，旧 `.doc` 请先另存为 `.docx`；加密/DRM 电子书不支持。
- EPUB 的文章边界取决于原书的内容文件划分；仓库预载期刊已验证为 70 篇。PDF 的文章边界由用户通过页码范围及可编辑正文明确指定。
- AI 处理单篇文章最多 6 万字符，避免静默截断。生成结果仍应结合原文核对。
- GitHub 公共 API 存在匿名请求额度限制，限流时保留已下载内容和目录缓存。

## 验证

```bash
npm test             # 真实 EPUB/MOBI 解析、提示词、模型输出结构与词数验证
npm run test:electron # Electron 端到端：加密、翻页/缩放/平移、查词限制、练习、手写照片判分、附件、导出和重启恢复
```

端到端测试使用独立临时数据目录，并在主进程模拟 ZenMux 响应，不使用真实密钥、不产生 AI 费用。真实 ZenMux 联通与模型效果需填入用户自己的有效密钥后验证。

外刊来源：<https://github.com/hehonghui/awesome-english-ebooks>。内容版权归原出版方；应用封面卡片是自制的排版导航，不是原刊封面。

已在本机 macOS Apple Silicon 上完成桌面版与打包版验证；其他平台提供构建配置，尚未在对应系统实测。
