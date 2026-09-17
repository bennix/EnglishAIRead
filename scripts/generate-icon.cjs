const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "../resources");
const font = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf";
if (fs.existsSync(font)) GlobalFonts.registerFromPath(font, "Folio Georgia");
const canvas = createCanvas(1024, 1024),
  ctx = canvas.getContext("2d");
ctx.fillStyle = "#edf1e5";
ctx.beginPath();
ctx.roundRect(22, 22, 980, 980, 220);
ctx.fill();
ctx.fillStyle = "#2d513b";
ctx.font = 'italic 800px "Folio Georgia", Georgia, serif';
ctx.fillText("f", 290, 775);
ctx.fillStyle = "#bb8058";
ctx.beginPath();
ctx.arc(734, 734, 53, 0, Math.PI * 2);
ctx.fill();
fs.writeFileSync(path.join(root, "icon.png"), canvas.toBuffer("image/png"));
if (process.platform === "darwin") {
  const iconset = path.join(root, "icon.iconset");
  fs.mkdirSync(iconset, { recursive: true });
  for (const size of [16, 32, 128, 256, 512])
    for (const scale of [1, 2])
      execFileSync(
        "sips",
        [
          "-z",
          String(size * scale),
          String(size * scale),
          path.join(root, "icon.png"),
          "--out",
          path.join(
            iconset,
            `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`,
          ),
        ],
        { stdio: "ignore" },
      );
  execFileSync("iconutil", [
    "-c",
    "icns",
    iconset,
    "-o",
    path.join(root, "icon.icns"),
  ]);
  fs.rmSync(iconset, { recursive: true });
}
