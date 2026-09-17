const fs = require("node:fs");
const path = require("node:path");
const { PDFParse } = require("pdf-parse");
const { parseEpub, htmlText, wordCount, id } = require("./core.cjs");
async function parseMobi(buffer, source, dataDir) {
  const { initMobiFile } = await import("@lingo-reader/mobi-parser");
  const resources = fs.mkdtempSync(path.join(dataDir, "mobi-"));
  let book;
  try {
    book = await initMobiFile(new Uint8Array(buffer), resources);
    const articles = [],
      titles = new Map();
    const visit = (items) =>
      items.forEach((item) => {
        const target = book.resolveHref(item.href);
        if (target) titles.set(target.id, item.label);
        if (item.children) visit(item.children);
      });
    visit(book.getToc());
    for (const chapter of book.getSpine()) {
      if (titles.size && !titles.has(chapter.id)) continue;
      const parsed = htmlText(
        chapter.text || book.loadChapter(chapter.id)?.html || "",
      );
      if (wordCount(parsed.text) >= 100)
        articles.push({
          id: id(),
          title:
            titles.get(chapter.id) ||
            parsed.title ||
            parsed.text.split("\n")[0].slice(0, 150) ||
            `Article ${articles.length + 1}`,
          text: parsed.text,
          source,
          addedAt: new Date().toISOString(),
        });
    }
    if (!articles.length)
      throw new Error(
        "MOBI 中没有可提取的正文。加密文件需要先解除 DRM 后再导入。",
      );
    return articles;
  } finally {
    book?.destroy();
    fs.rmSync(resources, { recursive: true, force: true });
  }
}
async function extractPdf(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const pages = result.pages.map((page) => page.text.trim());
    if (!pages.some((text) => wordCount(text) >= 10))
      throw new Error(
        "这是扫描 PDF 或没有可提取的英文正文。请先进行 OCR，或将页面作为图片附件提交给视觉模型。",
      );
    return pages;
  } finally {
    await parser.destroy();
  }
}
async function importBook(buffer, name, source, dataDir) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".epub") return { articles: parseEpub(buffer, source) };
  if (ext === ".mobi")
    return { articles: await parseMobi(buffer, source, dataDir) };
  if (ext === ".pdf") {
    const pages = await extractPdf(buffer),
      documentId = id();
    const directory = path.join(dataDir, "pdf-imports");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, documentId + ".json"),
      JSON.stringify({ pages, name, source }),
      { mode: 0o600 },
    );
    fs.writeFileSync(path.join(directory, documentId + ".pdf"), buffer, {
      mode: 0o600,
    });
    return { pdf: { id: documentId, name, pages } };
  }
  throw new Error("支持 EPUB、MOBI、PDF。");
}
function articleFromPdf(dataDir, input) {
  if (
    !/^[a-f0-9-]{36}$/.test(input.documentId) ||
    !Number.isInteger(input.start) ||
    !Number.isInteger(input.end)
  )
    throw new Error("PDF 页码无效。");
  const stored = JSON.parse(
    fs.readFileSync(
      path.join(dataDir, "pdf-imports", input.documentId + ".json"),
      "utf8",
    ),
  );
  if (
    input.start < 1 ||
    input.end < input.start ||
    input.end > stored.pages.length
  )
    throw new Error("页码范围超出 PDF。");
  const original = stored.pages.slice(input.start - 1, input.end).join("\n\n");
  const text = typeof input.text === "string" ? input.text.trim() : original;
  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.length > 200 ||
    wordCount(text) < 50 ||
    text.length > 60000
  )
    throw new Error("请输入标题，正文需有至少 50 个英文词且不超过 6 万字符。");
  return {
    id: id(),
    title: input.title.trim(),
    text,
    source: stored.source + ` · pp.${input.start}–${input.end}`,
    pdfDocumentId: input.documentId,
    addedAt: new Date().toISOString(),
  };
}
module.exports = { parseMobi, extractPdf, importBook, articleFromPdf };
