const { test } = require("node:test");
const assert = require("node:assert/strict");
const { aiError } = require("../electron/ai-error.cjs");

test("403 preserves provider access denial and request ID without exposing the key", async () => {
  const response = new Response(JSON.stringify({ error: {
    type: "access_denied",
    message: "No permission (api_key_source: payg) (request_id: test-123) secret-key",
  } }), { status: 403 });
  const error = await aiError(response, "secret-key");
  assert.match(error.message, /访问权限/);
  assert.match(error.message, /api_key_source: payg/);
  assert.match(error.message, /request_id: test-123/);
  assert.doesNotMatch(error.message, /secret-key|图片支持/);
});

test("HTML 403 does not diagnose model access or expose gateway HTML", async () => {
  const error = await aiError(new Response("<html>gateway</html>", { status: 403 }), "key");
  assert.match(error.message, /无法判断/);
  assert.doesNotMatch(error.message, /<html>|无权访问此模型/);
});
