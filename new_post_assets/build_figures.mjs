import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {launchBrowser} from "./browser.mjs";

const root=path.dirname(fileURLToPath(import.meta.url));
const browser=await launchBrowser();
try {
  const page=await browser.newPage();
  const draw=async(src,out,width,height,scale,theme) => {
    await page.setViewport({width,height,deviceScaleFactor:scale});
    await page.goto(pathToFileURL(path.join(root,src)).href,{waitUntil:"load"});
    await page.evaluate(async t => {
      if(t)document.documentElement.dataset.theme=t;
      await document.fonts.ready;
    },theme);
    const bounds=await page.evaluate(() => ({scroll:document.body.scrollHeight,height:innerHeight}));
    if(bounds.scroll>height+2)throw Error(`${src} clips ${bounds.scroll-height}px`);
    await page.screenshot({path:path.join(root,out)});
    console.log("Rendered",out);
  };
  const webp=async png=>{
    await page.screenshot({type:"webp",quality:92,path:path.join(root,png.replace(/\.png$/,".webp"))});
  };
  for (const [name,height] of [["fig1-anatomy",690],["fig2-history",512],["fig3-copy",780]]) {
    for (const theme of ["light","dark"]) {
      const dest=theme==="light" ? "openai-blog" : "elsewhere";
      const out=`${dest}/${name}.png`;
      await draw(`src/a-${name}.html`,out,800,height,2,theme);
      if (theme==="light")await webp(out);
    }
    // Legacy gallery links stay usable without maintaining divergent sources.
    const a=fs.readFileSync(path.join(root,`src/a-${name}.html`),"utf8");
    fs.writeFileSync(path.join(root,`src/b-${name}.html`),a.replace("<html",'<html data-theme="dark"'));
  }
  await draw("src/a-cover.html","openai-blog/cover.png",2400,900,1,"light");
  await webp("openai-blog/cover.png");
  await draw("src/b-cover.html","elsewhere/cover.png",1200,630,2,"dark");
} finally { await browser.close(); }
