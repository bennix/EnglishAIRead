const test = require("node:test");
const assert = require("node:assert/strict");
const { quizPreview } = require("../electron/quiz-preview.cjs");
test("quiz preview exposes passage and questions without answer keys or explanations", () => {
  assert.equal(quizPreview('{"passage":"A growing'), "A growing");
  const json = JSON.stringify({
    passage: "A passage.\nNext line.",
    questions: [
      { question: "Why?", answer: 2, explanation: "SECRET CORRECT ANSWER" },
    ],
  });
  for (let end = 0; end <= json.length; end++)
    assert.doesNotMatch(
      quizPreview(json.slice(0, end)),
      /SECRET|answer|explanation/,
    );
  assert.equal(quizPreview(json), "A passage.\nNext line.\n\nWhy?");
});
