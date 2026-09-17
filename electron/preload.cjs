const { contextBridge, ipcRenderer } = require("electron");
const invoke = async (channel, data) => {
  const result = await ipcRenderer.invoke(channel, data);
  if (!result.ok) throw new Error(result.error);
  return result.data;
};
contextBridge.exposeInMainWorld("folio", {
  chooseAttachments: () => invoke("attachment:choose"),
  chooseImages: () => invoke("attachment:choose", { imagesOnly: true }),
  addAttachment: (data) => invoke("attachment:add", data),
  pasteAttachments: () => invoke("attachment:paste"),
  copyText: (text) => invoke("clipboard:write", text),
  chat: (data) => invoke("ai:chat", data),
  lookupWord: (data) => invoke("ai:word", data),
  saveWord: (data) => invoke("vocabulary:save", data),
  deleteWord: (word) => invoke("vocabulary:delete", word),
  deleteHistory: (ids) => invoke("history:delete", ids),
  exportHistory: (data) => invoke("history:export", data),
  bootstrap: () => invoke("bootstrap"),
  saveSettings: (data) => invoke("settings:save", data),
  revealKey: () => invoke("settings:reveal"),
  testConnection: (data) => invoke("settings:test", data),
  listRepo: (path) => invoke("repo:list", path),
  importRepo: async (path, onProgress) => {
    const listener = (_event, progress) => {
      if (progress.path === path && typeof onProgress === "function")
        onProgress(progress);
    };
    ipcRenderer.on("repo:progress", listener);
    try {
      return await invoke("repo:import", path);
    } finally {
      ipcRenderer.removeListener("repo:progress", listener);
    }
  },
  createPdfArticle: (data) => invoke("pdf:article", data),
  importFile: () => invoke("file:import"),
  addArticle: (data) => invoke("article:add", data),
  saveProgress: (data) => invoke("progress:save", data),
  generateQuiz: (data) => invoke("ai:quiz", data),
  reviewSummary: (data) => invoke("ai:feedback", data),
  openExternal: (url) => invoke("external:open", url),
});
