// Check rendered article, asset availability and layout in real Chromium.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath,pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";
import {launchBrowser} from "./browser.mjs";
const assets=path.dirname(fileURLToPath(import.meta.url)), root=path.dirname(assets);
const receipts=JSON.parse(fs.readFileSync(path.join(assets,"post.json"),"utf8")).media;
for(const [name,media] of Object.entries(receipts)){
 const p=path.join(assets,"openai-blog",media.stem);
 for(const ext of [".mp4",".webm",".gif","-poster.webp",".json"])assert(fs.statSync(p+ext).size>0,p+ext);
 const receipt=JSON.parse(fs.readFileSync(p+".json","utf8"));
 assert.equal(receipt.scenario,name);
 if(name==="side")assert(receipt.columns>=145);
 const info=JSON.parse(execFileSync("ffprobe",["-v","error","-show_entries","format=duration:stream=width,height","-of","json",p+".mp4"],{encoding:"utf8"}));
 assert(Number(info.format.duration)>3,p+" too short");
 assert(info.streams[0].width>=1000);
}
const browser=await launchBrowser(), failures=[];
try{
 const page=await browser.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",req=>{if(/^https?:/.test(req.url()))errors.push("Network dependency: "+req.url())});
 for(const width of [390,768,1280,1440]){
  await page.setViewport({width,height:960,deviceScaleFactor:1});
  await page.goto(pathToFileURL(path.join(root,"new_post_preview.html")).href,{waitUntil:"load"});
  // Lazy figures below the fold load as the reader scrolls. Exercise that path.
  await page.evaluate(async()=>{
   for(const image of document.images){
    image.scrollIntoView({block:"center"});
    await image.decode();
   }
   window.scrollTo(0,0);
  });
  for(const theme of ["light","dark"]){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const report=await page.evaluate(()=>{
    const images=[...document.images];
    const figures=[...document.querySelectorAll("article figure")];
    return {scroll:document.documentElement.scrollWidth,window:innerWidth,
      broken:images.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),
      missingAlts:images.filter(i=>!i.alt.trim()).map(i=>i.src),
      videos:[...document.querySelectorAll("video")].map(v=>({autoplay:v.autoplay,controls:v.controls,poster:v.poster})),
      titles:document.querySelectorAll("h1").length,
      figures:figures.map(f=>!!f.querySelector("figcaption")),
      targets:[...document.querySelectorAll("aside a")].map(a=>!!document.getElementById(a.hash.slice(1))),
      cover:document.querySelector(".cover").getBoundingClientRect().height,
      theme:getComputedStyle(document.body).backgroundColor
    };
   });
   try{
    assert.equal(report.scroll,report.window,"horizontal overflow");
    assert.deepEqual(report.broken,[],"broken images");
    assert.deepEqual(report.missingAlts,[],"missing alt");
    assert.equal(report.titles,1);
    assert.equal(report.videos.length,3);
    assert(report.videos.every(v=>v.controls&&!v.autoplay&&v.poster));
    assert(report.figures.every(Boolean));
    assert(report.targets.every(Boolean));
    assert.equal(report.cover,width<576?230:300);
    assert.equal(report.theme,theme==="dark"?"rgb(17, 17, 17)":"rgb(255, 255, 255)");
    console.log("PASS",width,theme);
   }catch(e){failures.push(width+" "+theme+": "+e.message)}
   if(width===1440||width===390){
    const dir=path.join(assets,"gifs/out/review");
    fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,`preview-${width}-${theme}.png`),fullPage:true});
   }
  }
 }
 await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
 assert.equal(await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches),true);
 assert.deepEqual(errors,[]);
 assert.deepEqual(failures,[]);
}finally{await browser.close()}
console.log("All source receipts, media and responsive previews verified.");
