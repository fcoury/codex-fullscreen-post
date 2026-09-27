// Record the copy-on-select GIF: drag-select a code block in Codex, show the
// "Copied" confirmation, then paste the real clipboard HTML into a document.
//
// VHS can't drive the mouse, so this runs Codex in ttyd, drives headless Chrome
// with puppeteer-core, screenshots frames, and assembles them with ffmpeg.
//
// Env: DEMO_ROOT (from setup_demo.sh), CODEX_BIN. Output: out/copy.gif
// Note: Codex writes to the macOS clipboard. The script saves the plain-text
// clipboard first and restores it at the end.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const here = path.dirname(new URL(import.meta.url).pathname);
const tape = fs.readFileSync(path.join(here, "common.tape"), "utf8");
const setting = (k) => tape.match(new RegExp(`^Set ${k} (.+)$`, "m"))[1];
const W = Number(setting("Width")), H = Number(setting("Height")), BAR = 40, PAD = Number(setting("Padding"));
const PORT = 7690;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const theme = JSON.parse(setting("Theme"));
delete theme.name;
theme.selectionBackground = theme.selection;

const savedClipboard = execFileSync("pbpaste").toString();
// Always put the user's clipboard back, even if the recording fails.
process.on("exit", () => execFileSync("pbcopy", { input: savedClipboard }));

const ttyd = spawn("ttyd", [
  "-p", String(PORT), "-W", "-o",
  "-t", "fontFamily=JetBrains Mono", "-t", `fontSize=${setting("FontSize")}`,
  "-t", `lineHeight=${setting("LineHeight")}`,
  "-t", "cursorBlink=false", "-t", "disableLeaveAlert=true", "-t", "disableResizeOverlay=true",
  "-t", `theme=${JSON.stringify(theme)}`,
  "bash", path.join(here, "demo-codex.sh"), "resume", "--last",
], { stdio: "ignore", env: process.env });

const host = `<!doctype html><html><head><style>
  html,body{margin:0;background:${theme.background};overflow:hidden;font-family:-apple-system,system-ui,sans-serif}
  .bar{position:absolute;left:0;top:0;width:${W}px;height:${BAR}px}
  .dot{position:absolute;top:12px;width:12px;height:12px;border-radius:50%}
  iframe{position:absolute;left:${PAD}px;top:${BAR}px;width:${W - 2 * PAD}px;height:${H - BAR - PAD}px;border:0}
  #cursor{position:absolute;left:-50px;top:-50px;width:22px;height:22px;pointer-events:none;z-index:10}
  #doc{position:absolute;right:28px;top:64px;width:600px;height:0;opacity:0;transform:translateY(24px);
       transition:opacity .35s,transform .35s;background:#1d1e22;color:#e4e3de;border-radius:12px;
       border:1px solid #34353b;box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;z-index:5}
  #doc.show{opacity:1;transform:none;height:auto}
  #doc .top{height:36px;background:#26272c;border-bottom:1px solid #34353b;display:flex;align-items:center;
       padding:0 14px;font-size:13px;color:#9a9a93;gap:8px}
  #doc .top i{width:11px;height:11px;border-radius:50%;display:inline-block}
  #doc .body{padding:22px 28px 26px;font-size:16px;line-height:1.55;min-height:150px}
  #doc h3{margin:0 0 10px;font-size:20px}
  #doc p{margin:0 0 10px}
  #doc pre{background:#141518;border:1px solid #303137;border-radius:8px;padding:12px 14px;margin:0;
       font:14px/1.5 "JetBrains Mono",monospace;white-space:pre}
  #doc code{font-family:"JetBrains Mono",monospace;color:#93d4c0}
  #doc pre code{color:#e4e3de}
  .caret{display:inline-block;width:2px;height:19px;background:#e4e3de;vertical-align:-4px;animation:b 1s steps(1) infinite}
  @keyframes b{50%{opacity:0}}
  #keys{position:absolute;left:50%;bottom:72px;transform:translateX(-50%);opacity:0;transition:opacity .2s;
       background:rgba(20,20,24,.9);color:#fff;border:1px solid #444;border-radius:10px;padding:8px 16px;
       font:600 20px -apple-system,system-ui;z-index:20}
</style></head><body>
<div class="bar">
  <span class="dot" style="left:14px;background:#ff5f58"></span>
  <span class="dot" style="left:34px;background:#ffbd2e"></span>
  <span class="dot" style="left:54px;background:#18c132"></span>
</div>
<iframe src="http://127.0.0.1:${PORT}/"></iframe>
<svg id="cursor" viewBox="0 0 22 22"><path d="M5 2v16l4.2-4 2.8 6.3 2.4-1-2.8-6.2H17z"
  fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></svg>
<div id="doc"><div class="top"><i style="background:#ff5f58"></i><i style="background:#ffbd2e"></i>
  <i style="background:#18c132"></i><span style="margin-left:8px">PR description — Notes</span></div>
  <div class="body"><h3>Opt in to refill jitter</h3><div id="paste"><span class="caret"></span></div></div></div>
<div id="keys">⌘V</div>
</body></html>`;
const hostPath = path.join(here, "out", ".copy-host.html");
fs.mkdirSync(path.dirname(hostPath), { recursive: true });
fs.writeFileSync(hostPath, host);

await sleep(800);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: [`--window-size=${W},${H}`, "--allow-file-access-from-files", "--disable-web-security"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("file://" + hostPath);
const term = await (async () => {
  for (;;) {
    const f = page.frames().find((fr) => fr.url().includes(`:${PORT}`));
    if (f && (await f.evaluate(() => !!window.term).catch(() => false))) return f;
    await sleep(200);
  }
})();

// ttyd's fit can overshoot when lineHeight != 1, which hides Codex's bottom rows.
// Size the terminal from the real cell box instead.
await term.waitForFunction((size, lh) => window.term.options.fontSize === size &&
  window.term.options.lineHeight === lh, { polling: 100, timeout: 20000 },
  Number(setting("FontSize")), Number(setting("LineHeight")));
await sleep(500);
await term.evaluate(async () => {
  await document.fonts.ready;
  const t = window.term, cell = t._core._renderService.dimensions.css.cell;
  const box = t.element.parentElement.getBoundingClientRect();
  t.resize(Math.floor((box.width - 2) / cell.width), Math.floor(box.height / cell.height));
});
await sleep(600);

// Wait for Codex to finish replaying the session.
for (let i = 0; i < 100; i++) {
  const ready = await term.evaluate(() => {
    const b = window.term.buffer.active;
    for (let y = 0; y < window.term.rows; y++) {
      if (b.getLine(b.viewportY + y)?.translateToString().includes("Want me to squash")) return true;
    }
    return false;
  });
  if (ready) break;
  await sleep(200);
}
await sleep(1500);

// Locate the code block in screen cells, then convert to page pixels.
const geo = await term.evaluate(() => {
  const t = window.term, b = t.buffer.active, rows = [];
  for (let y = 0; y < t.rows; y++) rows.push(b.getLine(b.viewportY + y).translateToString(true));
  const first = rows.findIndex((r) => r.includes("For the PR description"));
  const last = rows.findIndex((r) => r.includes("refill_jitter = {"));
  if (first < 0 || last < 0) return { rows };
  const d = t._core._renderService.dimensions.css.cell;
  const rect = t.element.querySelector(".xterm-screen").getBoundingClientRect();
  return {
    first, last, cw: d.width, ch: d.height, x0: rect.left, y0: rect.top,
    startCol: rows[first].indexOf("For the PR description"), endCol: rows[last].trimEnd().length,
  };
});
if (geo.rows) {
  await page.screenshot({ path: path.join(here, "out", ".copy-debug.png") });
  console.error(geo.rows.join("\n"));
  ttyd.kill(); await browser.close(); process.exit(1);
}
const cell = (col, row) => ({
  x: PAD + geo.x0 + (col + 0.5) * geo.cw,
  y: BAR + geo.y0 + (row + 0.5) * geo.ch,
});

// Frame capture loop.
const frames = [];
let capturing = true;
const framesDir = path.join(here, "out", ".copy-frames");
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const capture = (async () => {
  while (capturing) {
    const t = Date.now();
    const file = path.join(framesDir, `f${String(frames.length).padStart(4, "0")}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, t });
    const spent = Date.now() - t;
    if (spent < 60) await sleep(60 - spent);
  }
})();

let cur = { x: W * 0.62, y: H * 0.55 };
const setCursor = (p) => page.evaluate(({ x, y }) => {
  const c = document.getElementById("cursor");
  c.style.left = x - 5 + "px"; c.style.top = y - 2 + "px";
}, p);
async function glide(to, ms) {
  const steps = Math.max(6, Math.round(ms / 30));
  const from = cur;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const p = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
    await page.mouse.move(p.x, p.y);
    await setCursor(p);
    await sleep(ms / steps);
  }
  cur = to;
}

await setCursor(cur);
await sleep(900);
const start = cell(geo.startCol, geo.first);
start.x -= geo.cw * 0.45;
await glide(start, 700);
await sleep(250);
await page.mouse.down();
await glide(cell(geo.endCol + 1, geo.last), 1300);
await sleep(200);
await page.mouse.up();
await sleep(2200);

// Paste the real clipboard HTML into the document window.
const hex = execFileSync("osascript", ["-e", "the clipboard as «class HTML»"]).toString();
const html = Buffer.from(hex.match(/«data HTML([0-9A-F]*)»/)?.[1] ?? "", "hex").toString("utf8");
const plain = execFileSync("pbpaste").toString();
fs.writeFileSync(path.join(here, "out", "copy-clipboard.html"), html);
fs.writeFileSync(path.join(here, "out", "copy-clipboard.txt"), plain);
await glide({ x: W * 0.72, y: H * 0.45 }, 500);
await page.evaluate(() => document.getElementById("doc").classList.add("show"));
await sleep(900);
await page.evaluate(() => (document.getElementById("keys").style.opacity = 1));
await sleep(450);
await page.evaluate((h) => {
  const body = h.replace(/^[\s\S]*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "");
  document.getElementById("paste").innerHTML = body + '<span class="caret"></span>';
}, html);
await sleep(350);
await page.evaluate(() => (document.getElementById("keys").style.opacity = 0));
await sleep(2400);

capturing = false;
await capture;
await browser.close();
ttyd.kill();

// Assemble with real timings.
const list = frames.map((f, i) => {
  const next = frames[i + 1]?.t ?? f.t + 100;
  return `file '${f.file}'\nduration ${((next - f.t) / 1000).toFixed(3)}`;
}).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
const listFile = path.join(framesDir, "list.txt");
fs.writeFileSync(listFile, list);
const out = path.join(here, "out", "copy.gif");
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile,
  "-vf", "fps=20,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
  out]);
console.log(`wrote ${out} (${frames.length} frames)`);
console.log("clipboard plain text:\n" + plain);
