// Record paste-both.gif: the clipboard from the copy recording pasted into a
// plain-text editor (Markdown) and a rich-text notes app (HTML).
// No Codex involved; paste-both.html holds the captured payloads and plays the
// sequence. Output: out/paste-both.gif
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const here = path.dirname(new URL(import.meta.url).pathname);
const W = 1200, H = 500;
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(here, "paste-both.html") + "?record", { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

const framesDir = path.join(here, "out", ".paste-frames");
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const frames = [];
let capturing = true;
const capture = (async () => {
  while (capturing) {
    const t = Date.now();
    const file = path.join(framesDir, `f${String(frames.length).padStart(4, "0")}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, t });
    const spent = Date.now() - t;
    if (spent < 50) await sleep(50 - spent);
  }
})();

await page.evaluate(() => window.play());
capturing = false;
await capture;
await browser.close();

const list = frames.map((f, i) => {
  const next = frames[i + 1]?.t ?? f.t + 100;
  return `file '${f.file}'\nduration ${((next - f.t) / 1000).toFixed(3)}`;
}).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
const listFile = path.join(framesDir, "list.txt");
fs.writeFileSync(listFile, list);
const out = path.join(here, "out", "paste-both.gif");
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile,
  "-vf", "fps=20,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
  out]);
fs.rmSync(framesDir, { recursive: true, force: true });
console.log(`wrote ${out} (${frames.length} frames)`);
