const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const core = require("./core.cjs");
const { aiError } = require("./ai-error.cjs");
const { downloadBook } = require("./download.cjs");
const { importBook, articleFromPdf } = require("./books.cjs");
const sample = require("./sample.json");
const preloaded = require("./preloaded.json");
const { registerStudy } = require("./study.cjs");
const { loadAttachment } = require("./attachments.cjs");
if (process.env.NODE_ENV === "test" && process.env.FOLIO_TEST_DATA)
  app.setPath("userData", process.env.FOLIO_TEST_DATA);
const BASE_URL = "https://zenmux.ai/api/v1";
const REPO = "hehonghui/awesome-english-ebooks";
const ROOTS = ["01_economist", "02_new_yorker", "04_atlantic", "05_wired"];
let win, dataDir, settings, library, progress, vocabulary, catalogCache;
function read(name, fallback) {
  const file = path.join(dataDir, name + ".json");
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fs.copyFileSync(file, file + ".corrupt-" + Date.now());
    return fallback;
  }
}
function write(name, data) {
  const file = path.join(dataDir, name + ".json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(file + ".tmp", file);
}
function encryptionAvailable() {
  return (
    safeStorage.isEncryptionAvailable() &&
    (!safeStorage.getSelectedStorageBackend ||
      safeStorage.getSelectedStorageBackend() !== "basic_text")
  );
}
function publicSettings() {
  return {
    models: settings.models,
    model: settings.model,
    hasApiKey: !!settings.encryptedKey,
    secureStorage: encryptionAvailable(),
    baseUrl: BASE_URL,
  };
}
function getKey() {
  if (!settings.encryptedKey)
    throw new Error("请先在设置中保存 ZenMux API Key。");
  try {
    return safeStorage.decryptString(
      Buffer.from(settings.encryptedKey, "base64"),
    );
  } catch {
    throw new Error("无法解密 API Key，请在设置中重新保存。");
  }
}
function articleById(id) {
  const article = library.find((a) => a.id === id);
  if (!article) throw new Error("文章不存在。");
  return article;
}
function levelCheck(level) {
  if (!core.LEVELS.includes(level)) throw new Error("请选择有效的考试难度。");
}
async function askAI(messages, validator) {
  const key = getKey();
  const model = settings.model;
  let response;
  try {
    response = await fetch(BASE_URL + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 6000,
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error("AI 请求超时或网络不可用，请稍后重试。");
  }
  if (!response.ok) throw await aiError(response, key);
  const body = await response.json();
  return {
    ...validator(core.parseJson(body.choices?.[0]?.message?.content)),
    model,
    generatedAt: new Date().toISOString(),
  };
}
function validRepoPath(value) {
  return (
    typeof value === "string" &&
    ROOTS.some((root) => value === root || value.startsWith(root + "/")) &&
    !value.includes("..") &&
    /^[\w./ -]+$/.test(value)
  );
}
async function repoList(repoPath) {
  if (!validRepoPath(repoPath)) throw new Error("无效的仓库路径。");
  const cache = catalogCache;
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${repoPath.split("/").map(encodeURIComponent).join("/")}?ref=master`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 403 || response.status === 429
          ? "GitHub 请求额度已用完，请稍后重试。"
          : `GitHub 目录读取失败（${response.status}）。`,
      );
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error("仓库目录格式不正确。");
    const result = items
      .filter(
        (item) => item.type === "dir" || /\.(epub|mobi|pdf)$/i.test(item.name),
      )
      .map(({ name, path, type, size }) => ({ name, path, type, size }))
      .sort((a, b) =>
        b.name.localeCompare(a.name, undefined, { numeric: true }),
      );
    cache[repoPath] = result;
    write("catalog", cache);
    return { items: result, cached: false };
  } catch (error) {
    if (cache[repoPath]) return { items: cache[repoPath], cached: true };
    throw new Error(
      error.name === "TimeoutError"
        ? "GitHub 连接超时，可以先导入本地 EPUB。"
        : error.message,
    );
  }
}
function addArticles(articles) {
  const existing = new Set(
    library.map((a) => `${a.publicationId || a.source}\n${a.title}`),
  );
  const added = articles.filter(
    (a) => !existing.has(`${a.publicationId || a.source}\n${a.title}`),
  );
  library = [...added, ...library];
  write("library", library);
  return { library, count: added.length };
}
function bind(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      throw new Error("不允许的请求。");
    try {
      return { ok: true, data: await handler(...args) };
    } catch (error) {
      return { ok: false, error: error.message || "操作失败，请重试。" };
    }
  });
}
function registerHandlers() {
  registerStudy({
    bind,
    dataDir,
    articleById,
    askAI,
    getKey,
    getModel: () => settings.model,
    getWindow: () => win,
    getProgress: () => progress,
    replaceProgress: (value) => {
      write("progress", value);
      progress = value;
    },
    getVocabulary: () => vocabulary,
    replaceVocabulary: (value) => {
      write("vocabulary", value);
      vocabulary = value;
    },
  });
  bind("bootstrap", () => ({
    settings: publicSettings(),
    library,
    progress,
    vocabulary,
  }));
  bind("settings:save", (input) => {
    if (
      !input ||
      !Array.isArray(input.models) ||
      !input.models.length ||
      input.models.length > 30 ||
      input.models.some(
        (m) => typeof m !== "string" || !/^[\w./:-]{1,120}$/.test(m),
      ) ||
      !input.models.includes(input.model)
    )
      throw new Error("模型名称无效，至少保留一个模型。");
    const next = {
      ...settings,
      models: [...new Set(input.models)],
      model: input.model,
    };
    if (input.removeKey === true) delete next.encryptedKey;
    if (input.apiKey) {
      if (
        typeof input.apiKey !== "string" ||
        input.apiKey.length > 4096 ||
        /\s/.test(input.apiKey)
      )
        throw new Error("API Key 不能包含空格或换行。");
      if (!encryptionAvailable())
        throw new Error(
          "系统安全存储不可用，请启用系统钥匙串或密钥管理器后重试。",
        );
      next.encryptedKey = safeStorage
        .encryptString(input.apiKey)
        .toString("base64");
    }
    write("settings", next);
    settings = next;
    return publicSettings();
  });
  bind("repo:list", repoList);
  bind("repo:import", async (repoPath) => {
    if (!validRepoPath(repoPath) || !/\.(epub|mobi|pdf)$/i.test(repoPath))
      throw new Error("请选择 EPUB、MOBI 或 PDF 文件。");
    const sender = win.webContents;
    const folder = repoPath.split("/").slice(0, -1).join("/");
    const expectedBytes =
      catalogCache[folder]?.find((item) => item.path === repoPath)?.size || 0;
    const buffer = await downloadBook(
      `https://raw.githubusercontent.com/${REPO}/master/${repoPath.split("/").map(encodeURIComponent).join("/")}`,
      (progress) => {
        if (!sender.isDestroyed())
          sender.send("repo:progress", { ...progress, path: repoPath });
      },
      expectedBytes,
    );
    const result = await importBook(
      buffer,
      repoPath,
      repoPath.split("/").slice(-2, -1)[0],
      dataDir,
    );
    return result.pdf
      ? result
      : addArticles(
          result.articles.map((article) => ({
            ...article,
            publicationId: repoPath.split("/").slice(0, -1).join("/"),
          })),
        );
  });
  bind("file:import", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [
        {
          name: "阅读素材",
          extensions: ["epub", "mobi", "pdf", "txt", "md", "html", "htm"],
        },
      ],
    });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if (fs.statSync(file).size > 40 * 1024 * 1024)
      throw new Error("文件不能超过 40 MB。");
    const buffer = fs.readFileSync(file),
      source = path.basename(file);
    if (/\.(epub|mobi|pdf)$/i.test(file)) {
      const result = await importBook(buffer, source, source, dataDir);
      return result.pdf ? result : addArticles(result.articles);
    }
    const parsed = /\.html?$/i.test(file)
      ? core.htmlText(buffer.toString("utf8"))
      : { title: path.parse(file).name, text: buffer.toString("utf8") };
    if (core.wordCount(parsed.text) < 50)
      throw new Error("请导入至少 50 个英文词的正文。");
    return addArticles([
      { ...parsed, id: core.id(), source, addedAt: new Date().toISOString() },
    ]);
  });
  bind("pdf:article", (input) => addArticles([articleFromPdf(dataDir, input)]));
  bind("article:add", (input) => {
    if (
      typeof input?.title !== "string" ||
      !input.title.trim() ||
      input.title.length > 200 ||
      typeof input.text !== "string" ||
      input.text.length > 200000 ||
      core.wordCount(input.text) < 50
    )
      throw new Error("请输入标题和至少 50 个英文词的正文（最多 20 万字符）。");
    return addArticles([
      {
        id: core.id(),
        title: input.title.trim(),
        text: input.text.trim(),
        source: "我的文章",
        addedAt: new Date().toISOString(),
      },
    ]);
  });
  bind("progress:save", ({ articleId, value }) => {
    articleById(articleId);
    if (!value || JSON.stringify(value).length > 5000000)
      throw new Error("阅读进度过大。");
    progress[articleId] = value;
    write("progress", progress);
    return true;
  });
  bind("ai:quiz", async ({ articleId, level }) => {
    levelCheck(level);
    const article = articleById(articleId);
    if (article.text.length > 60000)
      throw new Error("文章过长，请摘选一篇独立文章（最多 6 万字符）。");
    return askAI(core.quizMessages(article, level), core.validateQuiz);
  });
  bind(
    "ai:feedback",
    async ({ articleId, level, draft, inputMode, images }) => {
      levelCheck(level);
      const article = articleById(articleId);
      if (article.text.length > 60000)
        throw new Error("文章过长，请摘选一篇独立文章。");
      if (inputMode === "image") {
        if (!Array.isArray(images) || !images.length || images.length > 4)
          throw new Error("请上传 1–4 张手写作文照片。");
        const photos = images.map((image) => loadAttachment(dataDir, image.id));
        if (photos.some((photo) => photo.type !== "image"))
          throw new Error("手写作文需要图片附件。");
        return askAI(
          core.handwritingMessages(article, photos, level),
          core.validateHandwritingFeedback,
        );
      }
      if (
        typeof draft !== "string" ||
        core.wordCount(draft) < 100 ||
        core.wordCount(draft) > 200
      )
        throw new Error("请将英文概要控制在 100–200 词。");
      return askAI(
        core.feedbackMessages(article, draft, level),
        core.validateFeedback,
      );
    },
  );
  bind("external:open", (url) => {
    if (
      ![
        "https://zenmux.ai/invite/GBQMC5",
        "https://zenmux.ai/platform/subscription",
        "https://zenmux.ai",
        `https://github.com/${REPO}`,
      ].includes(url)
    )
      throw new Error("链接不在允许列表中。");
    return shell.openExternal(url);
  });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1510,
    height: 980,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#f7f6f2",
    title: "Folio · 英文阅读工作台",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_, __, callback) =>
    callback(false),
  );
  if (process.argv.includes("--dev")) win.loadURL("http://127.0.0.1:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
  dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });
  settings = read("settings", { models: core.MODELS, model: core.MODELS[0] });
  library = read("library", [...preloaded, sample]);
  progress = read("progress", {});
  vocabulary = read("vocabulary", []);
  catalogCache = read("catalog", {});
  registerHandlers();
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
