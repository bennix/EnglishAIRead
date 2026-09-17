const fs = require("node:fs");
const path = require("node:path");
const { nativeImage } = require("electron");
const { extractPdf } = require("./books.cjs");
const mammoth = require("mammoth");
const AdmZip = require("adm-zip");
const { id } = require("./core.cjs");
async function ingestAttachment(dataDir, name, buffer) {
  if (buffer.length > 10 * 1024 * 1024) throw new Error("每个附件最大 10 MB。");
  const ext = path.extname(name).toLowerCase();
  const attachment = {
    id: id(),
    name: path.basename(name).slice(0, 180),
    type: "document",
  };
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) throw new Error("无法读取这张图片。");
    attachment.type = "image";
    const size = image.getSize(),
      ratio = Math.min(1, 3200 / Math.max(size.width, size.height));
    const reduced = image.resize({
      width: Math.round(size.width * ratio),
      height: Math.round(size.height * ratio),
    });
    attachment.dataUrl =
      "data:image/jpeg;base64," + reduced.toJPEG(94).toString("base64");
    attachment.thumbnail =
      "data:image/jpeg;base64," +
      image.resize({ width: 160 }).toJPEG(65).toString("base64");
  } else if (ext === ".pdf") {
    attachment.text = (await extractPdf(buffer)).join("\n\n");
    if (!attachment.text)
      throw new Error("该 PDF 没有可提取的文字，请将扫描页作为图片添加。");
  } else if (ext === ".docx") {
    const zip = new AdmZip(buffer);
    if (
      zip.getEntries().reduce((sum, entry) => sum + entry.header.size, 0) >
      60 * 1024 * 1024
    )
      throw new Error("Word 文件解压后过大。");
    attachment.text = (await mammoth.extractRawText({ buffer })).value.trim();
  } else if ([".md", ".txt"].includes(ext))
    attachment.text = buffer.toString("utf8").trim();
  else
    throw new Error("支持 PNG、JPG、WEBP、GIF、PDF、Word (.docx)、MD 和 TXT。");
  if (attachment.type === "document" && !attachment.text)
    throw new Error("附件没有可读取的正文。");
  if (attachment.text?.length > 60000)
    throw new Error("附件正文超过 6 万字符，请拆分后添加。");
  fs.mkdirSync(path.join(dataDir, "attachments"), { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "attachments", attachment.id + ".json"),
    JSON.stringify(attachment),
    { mode: 0o600 },
  );
  const { dataUrl, text, ...metadata } = attachment;
  return { ...metadata, characters: text?.length };
}
function loadAttachment(dataDir, attachmentId) {
  if (typeof attachmentId !== "string" || !/^[a-f0-9-]{36}$/.test(attachmentId))
    throw new Error("无效附件。");
  const file = path.join(dataDir, "attachments", attachmentId + ".json");
  if (!fs.existsSync(file)) throw new Error("附件已丢失，请重新添加。");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
module.exports = { ingestAttachment, loadAttachment };
