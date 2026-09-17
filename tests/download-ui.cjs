const { _electron } = require("playwright");
const { expect } = require("@playwright/test");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "folio-download-"));
  const app = await _electron.launch({
    args: [path.resolve(__dirname, "..")],
    env: { ...process.env, NODE_ENV: "test", FOLIO_TEST_DATA: dir },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector(".publication-grid");
    await app.evaluate(() => {
      global.fetch = async (url) => {
        if (String(url).includes("api.github.com"))
          return new Response(
            JSON.stringify([
              {
                name: "wired-test.epub",
                path: "05_wired/wired-test.epub",
                type: "file",
                size: 524288,
              },
            ]),
          );
        let chunks = 0;
        return new Response(
          new ReadableStream({
            async pull(controller) {
              await new Promise((resolve) => setTimeout(resolve, 200));
              if (chunks++ < 16) controller.enqueue(new Uint8Array(32768));
              else controller.close();
            },
          }),
          { headers: { "content-length": "524288" } },
        );
      };
    });
    await page.locator(".publication-card").nth(3).click();
    await page.getByRole("button", { name: /wired-test.epub/ }).click();
    await expect(page.locator(".download-progress")).toBeVisible();
    await expect(page.locator(".download-progress-details")).toContainText(
      /KB\/s/,
    );
    await expect
      .poll(async () =>
        Number(await page.locator("progress").getAttribute("value")),
      )
      .toBeGreaterThan(0);
    await page.screenshot({
      path: path.resolve(__dirname, "../artifacts/download-progress.png"),
    });
    await expect(page.locator(".download-progress")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: /wired-test.epub/ }),
    ).toBeEnabled();
    console.log(
      "PASS: streamed download progress and speed visible; failure clears progress and enables retry.",
    );
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
