import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import puppeteer from "puppeteer-core";

// Use an isolated renderer for local HTML, never a person's managed browser profile.
export function chromePath() {
  if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
  const cache=process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(),".cache/codex-fullscreen-post/browsers");
  const matches=["chrome-headless-shell","headless_shell"].flatMap(n => [...fs.globSync(path.join(cache,"chromium_headless_shell-*","**",n))]).sort().reverse();
  if(!matches.length)throw Error(`No local renderer. Run PLAYWRIGHT_BROWSERS_PATH="${cache}" npx playwright-core install chromium-headless-shell`);
  return matches[0];
}
export const launchBrowser=() => puppeteer.launch({
  executablePath:chromePath(),headless:true,pipe:true,timeout:20000,
  args:["--no-sandbox","--disable-gpu","--hide-scrollbars"]
});
