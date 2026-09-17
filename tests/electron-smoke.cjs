const { _electron: electron } = require("playwright");
const { expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const ROOT = path.resolve(__dirname, "..");
const TEST_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "folio-test-"));
const summary =
  "The article examines the relationship between careful reading and meaningful understanding. It argues that readers should choose their pace according to the purpose of a text, rather than assuming that faster reading is always better. Reading in another language can encourage deeper thought because unfamiliar expressions invite active interpretation. The discussion of urban trees illustrates how close attention reveals questions of fairness and responsibility behind a simple policy. Writing a summary helps readers identify central arguments and distinguish essential evidence from secondary details. Finally, technology can support learning when it directs attention back to the source. The central recommendation is to use both speed and patience deliberately.";
(async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) {
    const page = document.addPage([600, 800]);
    let y = 740;
    page.drawText("Reading article " + (i + 1), { x: 40, y, font, size: 20 });
    y -= 40;
    for (const line of summary.match(/.{1,75}(?:\s|$)/g)) {
      page.drawText(line.trim(), { x: 40, y, font, size: 10 });
      y -= 17;
    }
  }
  const pdfFile = path.join(TEST_DATA, "reading.pdf");
  fs.writeFileSync(pdfFile, await document.save({ useObjectStreams: false }));
  const zip = new AdmZip();
  zip.addFile(
    "[Content_Types].xml",
    Buffer.from(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
  );
  zip.addFile(
    "_rels/.rels",
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
  );
  zip.addFile(
    "word/document.xml",
    Buffer.from(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' +
        summary +
        "</w:t></w:r></w:p></w:body></w:document>",
    ),
  );
  const docxFile = path.join(TEST_DATA, "notes.docx");
  zip.writeZip(docxFile);
  const mdFile = path.join(TEST_DATA, "notes.md");
  fs.writeFileSync(mdFile, "# Reading notes\n" + summary);
  let app;
  const errors = [];
  try {
    app = await electron.launch({
      executablePath: process.env.FOLIO_TEST_EXECUTABLE || undefined,
      args: process.env.FOLIO_TEST_EXECUTABLE ? [] : [ROOT],
      env: { ...process.env, NODE_ENV: "test", FOLIO_TEST_DATA: TEST_DATA },
    });
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.waitForSelector(".publication-grid");
    assert.equal(
      (await page.evaluate(() => window.folio.bootstrap())).library.length,
      71,
    );
    await page.screenshot({ path: path.join(ROOT, "artifacts/library.png") });
    // Main-process fetch stub exercises the actual IPC and validation without spending API credits.
    await app.evaluate((_, summary) => {
      const original = global.fetch;
      global.__requests = [];
      global.fetch = async (url, options) => {
        if (!String(url).startsWith("https://zenmux.ai/"))
          return original(url, options);
        const request = JSON.parse(options.body);
        global.__requests.push(request);
        const system = request.messages[0].content;
        let output;
        if (system.includes("exactly five"))
          output = {
            questions: Array.from({ length: 5 }, (_, i) => ({
              question: "What does the selected article suggest? " + (i + 1),
              options: [
                "Supported by the article",
                "An unsupported claim",
                "The opposite claim",
                "An unrelated detail",
              ],
              answer: 0,
              explanation: "原文支持第一个选项。",
            })),
          };
        else if (system.includes("printed text, screenshots"))
          output = {
            readable: true,
            transcription: summary,
            uncertainWords: [],
            criteria: {
              content: 35,
              organization: 18,
              language: 25,
              length: 10,
            },
            score: 88,
            feedback: "依据照片中的学生原稿评分。",
            suggestions: ["加强主题句与支持论据的联系。"],
            sample: summary,
          };
        else if (system.includes("English writing examiner"))
          output = {
            score: 86,
            criteria: {
              content: 35,
              organization: 17,
              language: 25,
              length: 10,
            },
            feedback: "概括清楚，注意保留核心论据。",
            suggestions: ["缩减重复表达。"],
            sample: summary,
          };
        else if (system.includes("bilingual dictionary"))
          output = {
            word: "Plunging",
            phonetic: "/ˈplʌndʒɪŋ/",
            meaning: "急剧下降的",
            example: "Test scores are plunging.",
            translation: "考试成绩正在急剧下降。",
          };
        else
          output =
            "## 核心观点\n\n这份材料其实**不是一篇完整的文章**，而是一个**杂志文章标题列表**。\n\n**证据**：\n\n- 每一行都是独立标题\n- 附件已作为参考资料读取\n\n| 项目 | 说明 |\n| --- | --- |\n| 内容 | 文章目录 |\n\n```text\nReading notes\n```\n\n<script>window.markdownUnsafe = true</script>";
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    typeof output === "string"
                      ? output
                      : JSON.stringify(output),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };
    }, summary);
    await page.getByRole("button", { name: "设置与模型" }).click();
    await page
      .getByLabel("API KEY", { exact: false })
      .fill("folio-test-secret-not-real");
    assert.equal(
      await page.locator("#api-key").getAttribute("type"),
      "password",
    );
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByText("已配置密钥", { exact: true })).toBeVisible();
    const stored = fs.readFileSync(
      path.join(TEST_DATA, "settings.json"),
      "utf8",
    );
    assert.ok(!stored.includes("folio-test-secret-not-real"));
    const settings = (await page.evaluate(() => window.folio.bootstrap()))
      .settings;
    assert.equal(settings.hasApiKey, true);
    assert.equal(settings.apiKey, undefined);
    assert.equal(settings.encryptedKey, undefined);
    await page.getByRole("button", { name: "显示密钥", exact: true }).click();
    await expect(page.locator("#api-key")).toHaveValue(
      "folio-test-secret-not-real",
    );
    await expect(page.locator("#api-key")).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "隐藏密钥", exact: true }).click();
    await expect(page.locator("#api-key")).toHaveValue("");
    await page.getByRole("button", { name: "测试连接", exact: true }).click();
    await expect(page.locator(".connection-test [role=status]")).toContainText(
      "连接成功",
    );
    await page.getByLabel("新增模型名称").fill("custom/model-test");
    await page.getByRole("button", { name: "添加模型", exact: true }).click();
    await page.getByRole("button", { name: "保存设置" }).click();
    await page.screenshot({ path: path.join(ROOT, "artifacts/settings.png") });
    await page.getByRole("button", { name: "阅读工作台" }).click();
    await page.waitForSelector(".article-body");
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(page.locator(".reading-pagination")).toContainText("2 /");
    await page.getByRole("button", { name: "放大", exact: true }).click();
    await expect(page.getByTitle("重置缩放")).toHaveText("110%");
    await page.getByRole("button", { name: "拖拽平移", exact: true }).click();
    await expect(page.locator(".reading-scroll")).toHaveClass(/panning/);
    const bounds = await page.locator(".reading-scroll").boundingBox();
    await page.mouse.move(bounds.x + 100, bounds.y + 300);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 100, bounds.y + 100, { steps: 5 });
    await page.mouse.up();
    assert.ok(
      (await page.locator(".reading-scroll").evaluate((el) => el.scrollTop)) >
        0,
    );
    await page.getByRole("button", { name: "关闭平移", exact: true }).click();
    await page.getByRole("button", { name: "上一页", exact: true }).click();
    // Select an actual source word and query it.
    await page.locator(".article-body h1").evaluate((el) => {
      const node = el.firstChild;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 8);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.getByRole("button", { name: "AI 查询释义" }).click();
    await page.getByRole("button", { name: "加入生词本" }).click();
    await page.getByRole("button", { name: "练习模式", exact: true }).click();
    await expect(page.locator(".word-popover")).toHaveCount(0);
    const state = await page.evaluate(() => window.folio.bootstrap());
    const article = state.library[6];
    const guard = await page.evaluate(async (articleId) => {
      try {
        await window.folio.lookupWord({
          articleId,
          word: "Plunging",
          mode: "practice",
        });
        return false;
      } catch (e) {
        return e.message.includes("练习模式");
      }
    }, article.id);
    assert.equal(guard, true);
    await page.getByRole("button", { name: "生成 5 道阅读题" }).click();
    await expect(page.locator(".question")).toHaveCount(5);
    for (let i = 0; i < 5; i++)
      await page
        .locator(".question")
        .nth(i)
        .locator(".options button")
        .first()
        .click();
    await page.getByRole("button", { name: "提交答案" }).click();
    await expect(page.locator(".quiz-status")).toContainText("5 / 5");
    await page.screenshot({ path: path.join(ROOT, "artifacts/quiz.png") });
    await page.getByRole("button", { name: "概要写作", exact: true }).click();
    await page.locator("#draft").fill(summary);
    await page.getByRole("button", { name: "获取 AI 写作反馈" }).click();
    await expect(page.locator(".score")).toContainText("87");
    await expect(page.locator(".score")).toContainText("托福标准");
    await page.getByRole("button", { name: "替换草稿" }).click();
    await expect(page.locator("#draft")).toHaveValue(summary);
    // Synthetic photo fixture; the vision response is mocked like the other AI calls.
    const photoFile = path.join(TEST_DATA, "handwriting-test.png");
    const { createCanvas } = require("@napi-rs/canvas");
    const canvas = createCanvas(900, 1200),
      context = canvas.getContext("2d");
    context.fillStyle = "#fffdf1";
    context.fillRect(0, 0, 900, 1200);
    context.fillStyle = "#304561";
    context.font = '25px "Comic Sans MS", cursive';
    summary
      .match(/.{1,55}(?:\s|$)/g)
      .forEach((line, i) => context.fillText(line.trim(), 55, 95 + i * 43));
    fs.writeFileSync(photoFile, canvas.toBuffer("image/png"));
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, photoFile);
    await page.getByRole("button", { name: "手写作文", exact: true }).click();
    await page
      .getByRole("button", { name: "上传作文图片", exact: true })
      .click();
    await expect(page.locator(".writing-photos img")).toHaveCount(1);
    await page
      .getByRole("button", { name: "识别并批阅手写作文", exact: true })
      .click();
    await expect(page.locator(".score")).toContainText("88");
    await expect(page.locator(".transcription > p")).toHaveText(summary);
    await expect(page.locator(".score-breakdown > div")).toHaveCount(4);
    await page.screenshot({
      path: path.join(ROOT, "artifacts/handwriting.png"),
    });
    await page.getByRole("button", { name: "AI 追问", exact: true }).click();
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: paths,
        });
      },
      [pdfFile, docxFile, mdFile],
    );
    await page.getByRole("button", { name: "添加附件", exact: true }).click();
    await expect(page.locator(".chat-composer .attachment")).toHaveCount(3);
    await app.evaluate(async ({ clipboard, ClipboardItem, nativeImage }) => {
      const bytes = nativeImage
        .createFromBitmap(Buffer.alloc(16 * 16 * 4, 128), {
          width: 16,
          height: 16,
        })
        .toPNG();
      await clipboard.write([
        new ClipboardItem({
          "image/png": new Blob([bytes], { type: "image/png" }),
        }),
      ]);
    });
    await page.getByRole("button", { name: "粘贴附件", exact: true }).click();
    await expect(page.locator(".chat-composer .attachment img")).toHaveCount(1);
    await page.getByLabel("AI 追问内容").fill("结合文章与附件解释核心观点。");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await expect(page.locator(".message.assistant")).toHaveCount(1);
    const markdown = page.locator(".message.assistant .markdown-content");
    await expect(markdown.locator("strong")).toHaveCount(3);
    await expect(markdown.locator("li")).toHaveCount(2);
    await expect(markdown.locator("table")).toHaveCount(1);
    await expect(markdown.locator("pre code")).toHaveText("Reading notes\n");
    await expect(markdown.locator("script")).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.markdownUnsafe), undefined);
    await page.screenshot({ path: path.join(ROOT, "artifacts/markdown.png") });
    await page
      .locator(".message.assistant")
      .getByRole("button", { name: "复制内容" })
      .click();
    assert.ok(
      (await app.evaluate(({ clipboard }) => clipboard.readText())).includes(
        "核心观点",
      ),
    );
    await page.getByLabel("AI 追问内容").fill("请进一步解释。");
    await page.getByRole("button", { name: "发送消息", exact: true }).click();
    await expect(page.locator(".message.assistant")).toHaveCount(2);
    const requests = await app.evaluate(() => global.__requests);
    assert.ok(
      requests.every((r) => !Object.hasOwn(r, "temperature")),
      "All AI requests must use model defaults without a temperature parameter",
    );
    assert.ok(requests.every((r) => r.model === "anthropic/claude-sonnet-5"));
    const handwritingRequest = requests.find((r) =>
      r.messages[0].content.includes("printed text, screenshots"),
    );
    assert.ok(
      handwritingRequest.messages[1].content.some(
        (item) => item.type === "image_url",
      ),
    );
    assert.equal(
      JSON.parse(handwritingRequest.messages[1].content[0].text).sourceArticle,
      article.text,
    );
    assert.equal(
      JSON.parse(
        requests.find((r) => r.messages[0].content.includes("exactly five"))
          .messages[1].content,
      ).article,
      article.text,
    );
    assert.ok(requests.at(-1).messages.length >= 4);
    assert.ok(
      requests.at(-1).messages[1].content.some((c) => c.type === "image_url"),
    );
    await page.screenshot({ path: path.join(ROOT, "artifacts/reader.png") });
    // PDF extraction and selectable article range.
    await app.evaluate(({ dialog }, pdfFile) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [pdfFile],
      });
    }, pdfFile);
    await page.getByRole("button", { name: "我的书架", exact: true }).click();
    await page.getByRole("button", { name: "本地导入", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "从 PDF 摘选一篇文章" }),
    ).toBeVisible();
    await page.locator("#pdf-title").fill("Imported PDF article");
    await page.getByRole("button", { name: "保存为独立文章" }).click();
    await expect(page.getByRole("status")).toContainText("已加入书架");
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    // Native history exports and batch deletion.
    await page.getByRole("button", { name: "历史记录", exact: false }).click();
    await page.getByLabel("全选", { exact: false }).check();
    const exportFile = path.join(TEST_DATA, "history.md");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportFile);
    await page.getByRole("button", { name: "批量导出", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已导出");
    const exported = fs.readFileSync(exportFile, "utf8");
    assert.ok(exported.includes("AI 追问"));
    assert.ok(exported.includes("参考范文"));
    const persisted = await page.evaluate(() => window.folio.bootstrap());
    assert.equal(persisted.vocabulary.length, 1);
    assert.equal(
      persisted.progress[article.id].practices["托福"].writingImages.length,
      1,
    );
    assert.equal(
      persisted.progress[article.id].practices["托福"].feedback.inputMode,
      "image",
    );
    assert.equal(persisted.progress[article.id].chat.length, 4);
    await app.close();
    app = await electron.launch({
      executablePath: process.env.FOLIO_TEST_EXECUTABLE || undefined,
      args: process.env.FOLIO_TEST_EXECUTABLE ? [] : [ROOT],
      env: { ...process.env, NODE_ENV: "test", FOLIO_TEST_DATA: TEST_DATA },
    });
    const second = await app.firstWindow();
    await second.waitForSelector(".publication-grid");
    const restored = await second.evaluate(() => window.folio.bootstrap());
    assert.equal(restored.settings.hasApiKey, true);
    assert.ok(restored.settings.models.includes("custom/model-test"));
    assert.equal(restored.progress[article.id].zoom, 110);
    assert.equal(restored.vocabulary.length, 1);
    await second
      .getByRole("button", { name: "历史记录", exact: false })
      .click();
    await second.getByLabel("全选", { exact: false }).check();
    second.once("dialog", (d) => d.accept());
    await second.getByRole("button", { name: "删除记录", exact: true }).click();
    await expect(second.getByText("第一篇，就从今天开始")).toBeVisible();
    assert.equal(
      Object.keys(
        (await second.evaluate(() => window.folio.bootstrap())).progress,
      ).length,
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 71 offline articles; encrypted settings; custom models; pagination/zoom/panning; contextual word lookup; practice guard; five-question quiz; writing feedback and handwritten-image grading; PDF/DOCX/MD/image attachments; chat follow-up/copy; PDF article import; history export/delete; restart persistence.",
    );
  } finally {
    if (app) await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
