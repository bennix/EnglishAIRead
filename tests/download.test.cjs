const test = require("node:test");
const assert = require("node:assert/strict");
const { downloadBook } = require("../electron/download.cjs");
async function runStream(headers) {
  const original = global.fetch,
    events = [];
  let index = 0;
  global.fetch = async () =>
    new Response(
      new ReadableStream({
        async pull(controller) {
          await new Promise((resolve) => setTimeout(resolve, 160));
          if (index++ < 4) controller.enqueue(new Uint8Array(1024));
          else controller.close();
        },
      }),
      { headers },
    );
  try {
    const buffer = await downloadBook("https://test.invalid/book", (event) =>
      events.push(event),
    );
    return { buffer, events };
  } finally {
    global.fetch = original;
  }
}
test("download reports transferred bytes, live speed and parsing phase", async () => {
  const { buffer, events } = await runStream({ "content-length": "4096" });
  assert.equal(buffer.length, 4096);
  assert.equal(events[0].stage, "connecting");
  assert.ok(
    events.some(
      (e) =>
        e.stage === "downloading" &&
        e.receivedBytes > 0 &&
        e.receivedBytes < 4096 &&
        e.bytesPerSecond > 0,
    ),
  );
  assert.equal(events.at(-1).stage, "parsing");
  assert.equal(events.at(-1).receivedBytes, events.at(-1).totalBytes);
});
test("chunked transfers keep unknown totals until completion", async () => {
  const { events } = await runStream({});
  assert.ok(
    events
      .filter((e) => e.stage === "downloading")
      .every((e) => e.totalBytes === null),
  );
  assert.equal(events.at(-1).totalBytes, 4096);
});
test("failed downloads do not emit a parsing/completion state", async () => {
  const original = global.fetch,
    events = [];
  global.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    await assert.rejects(
      downloadBook("https://test.invalid/book", (e) => events.push(e)),
      /503/,
    );
    assert.deepEqual(
      events.map((e) => e.stage),
      ["connecting"],
    );
  } finally {
    global.fetch = original;
  }
});
