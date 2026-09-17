const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const c = require("../electron/core.cjs");
const { parseMobi, extractPdf } = require("../electron/books.cjs");
test("real repository EPUB splits into separate articles in reading order", () => {
  const articles = c.parseEpub(
    fs.readFileSync("resources/TheEconomist.2026.09.12.epub"),
    "fixture",
  );
  assert.equal(articles.length, 70);
  assert.equal(new Set(articles.map((a) => a.id)).size, 70);
  const target = articles.find(
    (a) => a.title === "Plunging test scores are a slow-moving catastrophe",
  );
  assert.ok(target);
  assert.ok(c.wordCount(target.text) > 500);
  assert.ok(
    !target.text.includes("The truth and the lies about Islam in Europe"),
  );
});
test("real repository MOBI parses into independent articles", async () => {
  const articles = await parseMobi(
    fs.readFileSync("resources/TheEconomist.2026.09.12.mobi"),
    "fixture",
    "/tmp",
  );
  assert.ok(articles.length >= 60);
  assert.ok(articles.some((a) => a.text.includes("Plunging test scores")));
});
test("quiz validator rejects incorrect number, answer bounds and malformed options", () => {
  const question = {
    question: "Why?",
    options: ["A", "B", "C", "D"],
    answer: 0,
    explanation: "依据原文。",
  };
  const valid = {
    questions: Array.from({ length: 5 }, () => ({ ...question })),
  };
  assert.equal(c.validateQuiz(valid), valid);
  assert.throws(() => c.validateQuiz({ questions: [question] }), /5/);
  assert.throws(() =>
    c.validateQuiz({
      questions: [...valid.questions.slice(0, 4), { ...question, answer: 4 }],
    }),
  );
  assert.throws(() =>
    c.validateQuiz({
      questions: [
        ...valid.questions.slice(0, 4),
        { ...question, options: ["A"] },
      ],
    }),
  );
});
test("all five difficulty prompts carry only the selected article", () => {
  for (const level of c.LEVELS) {
    const messages = c.quizMessages({ text: "A single article." }, level);
    assert.equal(JSON.parse(messages[1].content).article, "A single article.");
    assert.ok(messages[0].content.includes("exactly five"));
  }
});
test("summary feedback requires an actual 100–200 word sample", () => {
  const sample = "word ".repeat(120);
  const data = {
    score: 85,
    feedback: "结构清晰",
    suggestions: ["补充关键证据"],
    sample,
  };
  assert.equal(c.validateFeedback(data), data);
  assert.throws(() => c.validateFeedback({ ...data, sample: "too short" }));
  assert.throws(() => c.validateFeedback({ ...data, score: 101 }));
});
test("model JSON and EPUB active content are treated as data", () => {
  assert.deepEqual(c.parseJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => c.parseJson("bad"));
  assert.equal(
    c.htmlText(
      "<html><body><script>alert(1)</script><p>Safe paragraph</p></body></html>",
    ).text,
    "Safe paragraph",
  );
});
test("English word counting handles hyphenated terms and apostrophes", () => {
  assert.equal(c.wordCount("It's a slow-moving change. 123 中文"), 4);
});
test("handwriting feedback refuses unreadable images and computes transparent rubric totals", () => {
  assert.throws(
    () => c.validateHandwritingFeedback({ readable: false }),
    /无法可靠辨认/,
  );
  const data = {
    readable: true,
    transcription: "word ".repeat(120),
    uncertainWords: [],
    criteria: { content: 35, organization: 18, language: 25, length: 10 },
    score: 1,
    feedback: "依据原稿。",
    suggestions: ["补充论据"],
    sample: "word ".repeat(120),
  };
  const result = c.validateHandwritingFeedback(data);
  assert.equal(result.score, 88);
  assert.equal(result.recognizedWordCount, 120);
  const short = c.validateHandwritingFeedback({
    ...data,
    transcription: "word ".repeat(80),
  });
  assert.equal(short.criteria.length, 0);
  assert.equal(short.score, 78);
  assert.throws(() =>
    c.validateHandwritingFeedback({
      ...data,
      criteria: { ...data.criteria, content: 90 },
    }),
  );
});
test("handwritten submission uses the photos and source article, not a typed draft", () => {
  const messages = c.handwritingMessages(
    { text: "The current source article." },
    [{ dataUrl: "data:image/jpeg;base64,fixture" }],
    "高考",
  );
  assert.equal(
    JSON.parse(messages[1].content[0].text).sourceArticle,
    "The current source article.",
  );
  assert.equal(messages[1].content[1].type, "image_url");
  assert.ok(
    messages[0].content.includes("preserving spelling and grammar errors"),
  );
});
