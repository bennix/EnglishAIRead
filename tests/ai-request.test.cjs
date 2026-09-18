const test = require("node:test");
const assert = require("node:assert/strict");
const { requestAI, AI_TIMEOUT_MS } = require("../electron/ai-request.cjs");
const input = { key: "secret", model: "test", messages: [] };

test("all model families receive a larger budget without disabling reasoning", async (t) => {
  t.mock.method(global, "fetch", async (_, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.max_tokens, 24000);
    assert.equal(request.stream_options.include_usage, true);
    assert.equal(request.reasoning, undefined);
    assert.equal(request.reasoning_effort, undefined);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
      }),
    );
  });
  for (const model of [
    "google/gemini-3.8-flash",
    "anthropic/claude-sonnet-5",
    "openai/gpt-5.4",
    "z-ai/glm-5v-turbo",
    "custom/model",
  ]) {
    await requestAI({ ...input, model });
  }
});

test("trailing stream usage is retained and distinguishes reasoning from total output", async (t) => {
  let reason = "stop";
  const usage = {
    completion_tokens: 23999,
    completion_tokens_details: { reasoning_tokens: 18000 },
  };
  t.mock.method(
    global,
    "fetch",
    async () =>
      new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "result" }, finish_reason: reason }] })}\n\ndata: ${JSON.stringify({ choices: [], usage })}\n\ndata: [DONE]\n\n`,
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  assert.deepEqual((await requestAI(input)).usage, usage);
  reason = "length";
  await assert.rejects(requestAI(input), (error) => {
    assert.equal(error.code, "AI_OUTPUT_LIMIT");
    assert.deepEqual(error.usage, usage);
    assert.match(error.message, /24000/);
    assert.match(error.message, /推理 18000/);
    return true;
  });
});

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
  const deltas = [];
  assert.equal(
    (await requestAI({ ...input, onDelta: (delta) => deltas.push(delta) }))
      .choices[0].message.content,
    "中文答案",
  );
  assert.deepEqual(deltas, ["中文", "答案"]);
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
