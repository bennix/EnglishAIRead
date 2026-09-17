import sample from "../electron/sample.json";

export const desktop = Boolean(window.folio);
const unsupported = async () => {
  throw new Error("此功能需要 Electron 桌面版，请运行 npm run dev。");
};
// The browser preview never stores API credentials or makes model requests.
export const api = window.folio || {
  bootstrap: async () => ({
    settings: {
      models: [
        "anthropic/claude-sonnet-4.6",
        "z-ai/glm-5v-turbo",
        "openai/gpt-5.4",
      ],
      model: "anthropic/claude-sonnet-4.6",
      hasApiKey: false,
      secureStorage: false,
      baseUrl: "https://zenmux.ai/api/v1",
    },
    library: [...(await import("../electron/preloaded.json")).default, sample],
    progress: {},
    vocabulary: [],
  }),
  saveProgress: async () => true,
  copyText: (text) => navigator.clipboard.writeText(text),
  openExternal: (url) => window.open(url, "_blank", "noopener,noreferrer"),
  ...Object.fromEntries(
    [
      "saveSettings",
      "listRepo",
      "importRepo",
      "importFile",
      "createPdfArticle",
      "addArticle",
      "generateQuiz",
      "reviewSummary",
      "chooseAttachments",
      "chooseImages",
      "pasteAttachments",
      "addAttachment",
      "chat",
      "lookupWord",
      "saveWord",
      "deleteWord",
      "deleteHistory",
      "exportHistory",
    ].map((name) => [name, unsupported]),
  ),
};
export const wordCount = (text) =>
  (text?.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
export const LEVELS = ["高考", "四级", "六级", "托福", "GRE"];
export const PUBLICATIONS = [
  {
    name: "The Economist",
    cn: "经济学人",
    category: "商业 · 政治 · 全球议题",
    path: "01_economist",
    className: "economist",
    initial: "E",
    cadence: "每周更新",
  },
  {
    name: "The New Yorker",
    cn: "纽约客",
    category: "文化 · 文学 · 深度观察",
    path: "02_new_yorker",
    className: "newyorker",
    initial: "N",
    cadence: "每周更新",
  },
  {
    name: "The Atlantic",
    cn: "大西洋月刊",
    category: "社会 · 思想 · 当代生活",
    path: "04_atlantic",
    className: "atlantic",
    initial: "A",
    cadence: "每月更新",
  },
  {
    name: "WIRED",
    cn: "连线",
    category: "科技 · 创新 · 未来",
    path: "05_wired",
    className: "wired",
    initial: "W",
    cadence: "每月更新",
  },
];
