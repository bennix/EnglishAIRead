const MAX_BYTES = 40 * 1024 * 1024;
async function downloadBook(url, onProgress, expectedBytes = 0) {
  let receivedBytes = 0,
    totalBytes = expectedBytes > 0 ? expectedBytes : null;
  let speed = 0,
    lastBytes = 0,
    lastTime = performance.now();
  const report = (stage) =>
    onProgress({ stage, receivedBytes, totalBytes, bytesPerSecond: speed });
  report("connecting");
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`下载失败（${response.status}）。`);
  const length = Number(response.headers.get("content-length"));
  if (length > 0 && !response.headers.get("content-encoding"))
    totalBytes = length;
  if (totalBytes > MAX_BYTES) {
    await response.body.cancel();
    throw new Error("文件超过 40 MB，请先拆分文件。");
  }
  lastTime = performance.now();
  report("downloading");
  const timer = setInterval(() => {
    const now = performance.now();
    speed = ((receivedBytes - lastBytes) * 1000) / Math.max(1, now - lastTime);
    lastBytes = receivedBytes;
    lastTime = now;
    report("downloading");
  }, 250);
  const chunks = [];
  try {
    for await (const chunk of response.body) {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_BYTES)
        throw new Error("文件超过 40 MB，请先拆分文件。");
      chunks.push(chunk);
    }
    totalBytes = receivedBytes;
    report("parsing");
    return Buffer.concat(chunks);
  } finally {
    clearInterval(timer);
  }
}
module.exports = { downloadBook };
