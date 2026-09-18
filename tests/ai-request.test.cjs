const test = require("node:test");
const assert = require("node:assert/strict");
const { requestAI, AI_TIMEOUT_MS } = require("../electron/ai-request.cjs");
const input = { key: "secret", model: "test", messages: [] };

test("streaming joins split UTF-8 chunks and ignores reasoning and heartbeats", async (t) => {
  const wire =
    ': heartbeat\r\ndata: {"choices":[{"delta":{"reasoning_content":"private"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"中文"}}]}\n\ndata: {"choices":[{"delta":{"content":"答案"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(wire);
  t.mock.method(global, "fetch", async (_, options) => {
    assert.equal(JSON.parse(options.body).stream, true);
    assert.equal(JSON.parse(options.body).temperature, undefined);
    return new Response(
      new ReadableStream({
        start(c) {
          for (const byte of bytes) c.enqueue(Uint8Array.of(byte));
          c.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  assert.equal((await requestAI(input)).choices[0].message.content, "中文答案");
  assert.equal(AI_TIMEOUT_MS, 600000);
});

test("deadline covers response body and aborts a stalled stream", async (t) => {
  t.mock.method(
    global,
    "fetch",
    async (_, { signal }) =>
      new Response(
        new ReadableStream({
          start(c) {
            signal.addEventListener("abort", () =>
              c.error(new DOMException("Aborted", "AbortError")),
            );
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  await assert.rejects(requestAI({ ...input, timeoutMs: 20 }), /已停止等待/);
});

test("incomplete streams and token limits are not returned as valid answers", async (t) => {
  let text = 'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n';
  t.mock.method(
    global,
    "fetch",
    async () =>
      new Response(text, { headers: { "content-type": "text/event-stream" } }),
  );
  await assert.rejects(requestAI(input), /传输中断/);
  text =
    'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n';
  await assert.rejects(requestAI(input), /输出上限/);
});

test("JSON fallback and platform timeout diagnostics remain supported", async (t) => {
  let response = new Response(
    JSON.stringify({ choices: [{ message: { content: "OK" } }] }),
  );
  t.mock.method(global, "fetch", async () => response);
  assert.equal((await requestAI(input)).choices[0].message.content, "OK");
  response = new Response("gateway timeout", { status: 504 });
  await assert.rejects(requestAI(input), /上游模型响应超时/);
});
