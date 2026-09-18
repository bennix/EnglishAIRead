const test = require("node:test");
const assert = require("node:assert/strict");
const { validateQuiz, quizMessages } = require("../electron/core.cjs");
function fixture(type, count = 15, words = 270) {
  const total = type === "word-bank" ? 10 : count;
  return {
    passage:
      "context ".repeat(words - total) +
      Array.from({ length: total }, (_, i) => `[[${i + 1}]]`).join(" "),
    wordBank: [
      "growth",
      "steady",
      "rapid",
      "develop",
      "clearly",
      "effort",
      "support",
      "deep",
      "nearly",
      "change",
      "purpose",
    ],
    questions: Array.from({ length: total }, (_, i) => ({
      options: ["one", "two", "three", "four"],
      answer: type === "word-bank" ? i : i % 4,
      explanation: "上下文支持，其他选项不合搭配。",
    })),
  };
}
test("gap quizzes enforce count, length, ordered markers, options and unique bank usage", () => {
  for (const [type, count] of [
    ["word-bank", 10],
    ["cloze", 15],
    ["cloze", 20],
  ]) {
    const valid = fixture(type, count);
    const result = validateQuiz(valid, type, count);
    assert.equal(result.wordCount, 270);
    assert.equal(result.questions.length, count);
    assert.throws(() =>
      validateQuiz(
        { ...valid, passage: valid.passage.replace("[[2]]", "[[1]]") },
        type,
        count,
      ),
    );
    assert.throws(() =>
      validateQuiz(
        { ...valid, questions: valid.questions.slice(1) },
        type,
        count,
      ),
    );
    assert.throws(() => validateQuiz(fixture(type, count, 249), type, count));
    assert.throws(() =>
      validateQuiz(
        fixture(type, count, type === "cloze" ? 301 : 351),
        type,
        count,
      ),
    );
    assert.throws(() =>
      validateQuiz(
        {
          ...valid,
          questions: valid.questions.map((q) => ({ ...q, answer: 11 })),
        },
        type,
        count,
      ),
    );
    assert.throws(() =>
      validateQuiz(
        {
          ...valid,
          questions: valid.questions.map((q) => ({ ...q, explanation: "" })),
        },
        type,
        count,
      ),
    );
  }
  const bank = fixture("word-bank");
  assert.throws(() =>
    validateQuiz(
      { ...bank, questions: bank.questions.map((q) => ({ ...q, answer: 0 })) },
      "word-bank",
    ),
  );
  assert.throws(() =>
    validateQuiz({ ...bank, wordBank: Array(11).fill("same") }, "word-bank"),
  );
  assert.equal(validateQuiz(bank, "word-bank").questions[0].options.length, 11);
  assert.throws(() => quizMessages({ text: "Source" }, "高考", "cloze", 17));
});
test("gap prompts distinguish Shanghai syntax/collocation from discourse cloze", () => {
  const bank = quizMessages({ text: "Source" }, "高考", "word-bank");
  assert.match(bank[0].content, /UNCHANGED/);
  assert.match(bank[0].content, /syntactic role/);
  assert.match(bank[0].content, /one unused distractor/);
  const cloze = quizMessages({ text: "Source" }, "高考", "cloze", 20);
  assert.match(cloze[0].content, /exactly 20/);
  assert.match(cloze[0].content, /NOT isolated grammar/);
  assert.equal(JSON.parse(cloze[1].content).article, "Source");
});
