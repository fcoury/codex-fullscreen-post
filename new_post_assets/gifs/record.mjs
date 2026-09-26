// Drive actual Codex in a PTY, rendered by xterm. Captures local screenshots only.
// CODEX_BIN must be accompanied by build.json and the matching Code Mode host.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {createHash} from "node:crypto";
import pty from "node-pty";
import {WebSocketServer} from "ws";
import {launchBrowser} from "../browser.mjs";

const here=path.dirname(fileURLToPath(import.meta.url)), assets=path.dirname(here);
const name=process.argv[2];
if(!["hero","copy","side"].includes(name))throw Error("Usage: CODEX_BIN=… node gifs/record.mjs hero|copy|side");
const bin=process.env.CODEX_BIN;
if(!bin || !path.isAbsolute(bin))throw Error("Set CODEX_BIN to a source-built absolute path");
const build=JSON.parse(fs.readFileSync(path.join(path.dirname(bin),"build.json"),"utf8"));
for (const exe of ["codex","codex-code-mode-host"]) {
 const data=fs.readFileSync(path.join(path.dirname(bin),exe));
 if(createHash("sha256").update(data).digest("hex")!==build.sha256[exe])throw Error("Build receipt mismatch: "+exe);
}
const env={...process.env,CODEX_BIN:bin,SCENARIO_NAME:name};
const root=execFileSync("bash",[path.join(here,"setup_demo.sh")],{env,encoding:"utf8"}).trim();
env.DEMO_ROOT=root;
const cols=name==="side" ? 150 : 120, rows=36, width=cols*10+52, height=850;
const out=path.join(here,"out",name);
fs.mkdirSync(out,{recursive:true});
for (const f of fs.readdirSync(out))if(/^f\d+\.png$/.test(f))fs.unlinkSync(path.join(out,f));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let terminal, browser, client, socket, raw="", fixtureRequests=0;
// The real clipboard is exercised only for the copy scenario. Keep the user's
// existing plain-text clipboard out of files and restore it even on failure.
const previousClipboard=name==="copy" ? execFileSync("pbpaste") : null;
const theme={background:"#10110f",foreground:"#eeeeea",cursor:"#eeeeea",selectionBackground:"#415780",
 black:"#191a18",brightBlack:"#878780",red:"#ea7773",green:"#87bd94",yellow:"#d6c27d",blue:"#98b6e7"};
const server=createServer((req,res)=>{
 if(req.url==="/term.js"||req.url==="/term.css"){
  const f=req.url==="/term.js"?"lib/xterm.js":"css/xterm.css";
  res.setHeader("content-type",f.endsWith(".js")?"text/javascript":"text/css");
  return res.end(fs.readFileSync(path.join(assets,"node_modules/@xterm/xterm",f)));
 }
 if(req.url?.startsWith("/v1/")){
  // Small live, loopback-only Responses fixture for the preview side question.
  let body="";req.on("data",b=>body+=b);req.on("end",()=>{
   fixtureRequests++;
   if(!req.url.includes("responses")){
     res.writeHead(200,{"content-type":"application/json"});
     return res.end(JSON.stringify({object:"list",data:[]}));
   }
   const id="post_demo_"+fixtureRequests, msgid="msg_"+id;
   const text="Nothing in shard.rs depends on iteration order. Expired keys are sorted before eviction.";
   res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache"});
   const send=(type,props)=>res.write("event: "+type+"\ndata: "+JSON.stringify({type,...props})+"\n\n");
   const message={id:msgid,type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text,annotations:[]}]};
   send("response.created",{response:{id,object:"response",status:"in_progress",output:[]}});
   send("response.output_item.added",{output_index:0,item:{...message,status:"in_progress",content:[]}});
   send("response.content_part.added",{item_id:msgid,output_index:0,content_index:0,part:{type:"output_text",text:"",annotations:[]}});
   send("response.output_text.delta",{item_id:msgid,output_index:0,content_index:0,delta:text});
   send("response.output_text.done",{item_id:msgid,output_index:0,content_index:0,text});
   send("response.content_part.done",{item_id:msgid,output_index:0,content_index:0,part:message.content[0]});
   send("response.output_item.done",{output_index:0,item:message});
   send("response.completed",{response:{id,object:"response",status:"completed",output:[message],usage:{input_tokens:20,output_tokens:16,total_tokens:36}}});
   res.end();
  });
  return;
 }
 res.setHeader("content-type","text/html; charset=utf-8");
 res.end(`<!doctype html><html><head><link rel="stylesheet" href="/term.css"><style>
 *{box-sizing:border-box}body{margin:0;background:${theme.background};color:${theme.foreground};overflow:hidden;font:15px -apple-system,system-ui,sans-serif}
 .bar{height:42px;display:flex;align-items:center;padding:0 22px;gap:8px;color:#999;font-size:13px}
 .dot{width:10px;height:10px;border:1px solid #999;border-radius:100%}
 .bar span:last-child{margin-left:auto}
 #term{position:absolute;top:48px;left:24px}
 #paste{position:absolute;bottom:84px;right:30px;max-width:595px;padding:22px;background:#fafaf6;color:#20201d;border:1px solid #aaa;border-radius:8px;display:none;z-index:2}
 #paste b.label{display:block;margin-bottom:14px;color:#58584e;font-size:13px}
 #paste pre{background:#f1f1eb;padding:14px;font:15px ui-monospace,Menlo,monospace}
 </style></head><body><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span>Codex · ${cols} columns</span></div>
 <div id="term"></div><div id="paste"><b class="label">Formatted clipboard contents</b><div id="payload"></div></div>
 <script src="/term.js"></script><script>
 const t=window.term=new Terminal({cols:${cols},rows:${rows},fontFamily:"Menlo,monospace",fontSize:16,
 lineHeight:1.15,theme:${JSON.stringify(theme)},cursorBlink:false,allowProposedApi:true,scrollback:1000});
 t.open(document.getElementById("term"));
 const ws=new WebSocket("ws://"+location.host);
 ws.onmessage=e=>t.write(e.data);t.onData(s=>ws.send(s));
 window.termText=()=>{const b=t.buffer.active;return Array.from({length:t.rows},(_,y)=>b.getLine(b.viewportY+y)?.translateToString(true) || "").join("\\n")};
 </script></body></html>`);
});
try{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const port=server.address().port;
 if(name==="side"){
  const cfg=path.join(root,"demo-home/config.toml");
  fs.writeFileSync(cfg,fs.readFileSync(cfg,"utf8").replace("http://127.0.0.1:9/v1",`http://127.0.0.1:${port}/v1`));
 }
 socket=new WebSocketServer({server});
 socket.on("connection",ws=>{
  client=ws;
  terminal=pty.spawn("bash",[path.join(here,"demo-codex.sh"),"resume","--last"],{
   cols,rows,name:"xterm-256color",cwd:here,env
  });
  terminal.onData(s=>{raw+=s;if(ws.readyState===1)ws.send(s)});
  ws.on("message",b=>terminal.write(b.toString()));
 });
 browser=await launchBrowser();
 const page=await browser.newPage();
 await page.setViewport({width,height,deviceScaleFactor:1});
 await page.goto(`http://127.0.0.1:${port}/`);
 const text=()=>page.evaluate(()=>window.termText());
 async function until(needle, timeout=25000) {
  const end=Date.now()+timeout;
  while(Date.now()<end){
   const s=await text();
   if(s.includes(needle))return s;
   await wait(120);
  }
  const s=await text();
  fs.writeFileSync(path.join(out,"last-screen.txt"),s);
  await page.screenshot({path:path.join(out,"failed.png")});
  throw Error(`Timed out waiting for "${needle}". See ${out}/last-screen.txt`);
 }
 await until("Want me to squash");
 const frames=[];
 async function snap(ms=180){
  const f=path.join(out,`f${String(frames.length).padStart(4,"0")}.png`);
  await page.screenshot({path:f});
  frames.push({f,ms});
 }
 async function hold(ms){await wait(200);await snap(ms)}
 async function key(s){terminal.write(s);await wait(140)}
 await hold(950);
 await page.screenshot({type:"webp",quality:90,path:path.join(out,name+"-poster.webp")});
 if(name==="hero"){
  for(let i=0;i<4;i++){await key("\x1b[5~");await snap(240)}
  for(let i=0;i<160;i++){
    if((await text()).includes("Read through this crate"))break;
    await key("\x1b[5~");if(i%8===0)await snap(100);
  }
  await until("Read through this crate");
  fs.writeFileSync(path.join(out,"first-screen.txt"),await text());
  await hold(1700);
  await key("\x1b");
  await until("Want me to squash");
  await hold(2000);
 }else if(name==="copy"){
  const geo=await page.evaluate(()=>{
   const t=window.term,b=t.buffer.active;const lines=Array.from({length:t.rows},(_,i)=>b.getLine(b.viewportY+i)?.translateToString(true)||"");
   const first=lines.findIndex(r=>r.includes("For the PR description"));
   const last=lines.findIndex(r=>r.includes("refill_jitter = {"));
   if(first<0||last<0)return {lines};
   const rect=document.querySelector(".xterm-screen").getBoundingClientRect(),cell=t._core._renderService.dimensions.css.cell;
   return {x:rect.x+(lines[first].indexOf("For the PR description")+0.08)*cell.width,y:rect.y+(first+.5)*cell.height,
    x2:rect.x+(lines[last].trimEnd().length+.5)*cell.width,y2:rect.y+(last+.5)*cell.height};
  });
  if(geo.lines)throw Error("Copy lines missing: "+geo.lines.join("\n"));
  await page.mouse.move(geo.x,geo.y);
  await page.mouse.down();
  for(let i=1;i<=14;i++){
    await page.mouse.move(geo.x+(geo.x2-geo.x)*i/14,geo.y+(geo.y2-geo.y)*i/14);
    await snap(82);
  }
  await page.mouse.up();
  await until("Copied");
  await hold(1700);
  const plain=execFileSync("pbpaste",{encoding:"utf8"});
  const hex=execFileSync("osascript",["-e","the clipboard as «class HTML»"],{encoding:"utf8"});
  const html=Buffer.from(hex.match(/«data HTML([0-9A-F]*)»/)?.[1]||"","hex").toString();
  if(!plain.includes("refill_jitter") || !html.includes("refill_jitter"))throw Error("Expected clipboard text/html absent");
  fs.writeFileSync(path.join(out,"clipboard.txt"),plain);
  fs.writeFileSync(path.join(out,"clipboard.html"),html);
  await page.evaluate(h=>{
   const doc=new DOMParser().parseFromString(h,"text/html");
   document.getElementById("payload").replaceChildren(...doc.body.childNodes);
   document.getElementById("paste").style.display="block";
  },html);
  await hold(2250);
 }else{
  await key("/side");await key("\r");
  await wait(1100);
  await snap(850);
  // Show real independent drafts and focus, which do not depend on model latency.
  await key("Does HashMap define iteration order?");
  await hold(1550);
  await key("\x1f"); // Ctrl+/ on a legacy PTY
  await wait(420);
  await key("Check the benchmark next");
  await hold(1550);
  fs.writeFileSync(path.join(out,"split-screen.txt"),await text());
  const s=await text();
  if(!s.includes("Does HashMap")||!s.includes("benchmark next")||!s.includes("│"))
    throw Error("Both drafts and the divider must be visible in the /side capture");
  // Use the real split as the poster, then show each composer at article size.
  await page.screenshot({type:"webp",quality:90,path:path.join(out,name+"-poster.webp")});
  await page.evaluate(()=>{
    const t=document.getElementById("term");
    t.style.transformOrigin="left bottom";
    t.style.transform="scale(1.6)";
  });
  await hold(1500);
  await key("\x1f");
  await page.evaluate(()=>{
    const t=document.getElementById("term");
    t.style.transformOrigin="right bottom";
  });
  await hold(1500);
  await page.evaluate(()=>document.getElementById("term").style.transform="none");
  await hold(1100);
 }
 const list=frames.map(({f,ms})=>`file '${f}'\nduration ${ms/1000}`).join("\n")+`\nfile '${frames.at(-1).f}'\n`;
 fs.writeFileSync(path.join(out,"frames.txt"),list);
 const ff=(...args)=>execFileSync("ffmpeg",["-v","error","-y",...args],{stdio:"inherit"});
 const src=["-f","concat","-safe","0","-i",path.join(out,"frames.txt")];
 ff(...src,"-vf","fps=20,format=yuv420p","-c:v","libx264","-crf","20","-movflags","+faststart",path.join(out,name+".mp4"));
 ff(...src,"-vf","fps=16","-c:v","libvpx-vp9","-crf","32","-b:v","0",path.join(out,name+".webm"));
 ff(...src,"-vf","fps=12,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer","-loop","0",path.join(out,name+".gif"));
 const receipt={commit:build.commit,version:build.version,sha256:build.sha256,columns:cols,rows,fixtureRequests,frames:frames.length,scenario:name};
 fs.writeFileSync(path.join(out,name+".json"),JSON.stringify(receipt,null,2)+"\n");
 // Publish only after assertions and all four encoders finish.
 for(const suffix of [".mp4",".webm",".gif","-poster.webp",".json"]){
  fs.copyFileSync(path.join(out,name+suffix),path.join(assets,"openai-blog",name+suffix));
 }
 console.log("Recorded",name,receipt.commit,cols,"columns");
}finally{
 if(previousClipboard)execFileSync("pbcopy",{input:previousClipboard});
 if(terminal)terminal.kill();
 if(client)client.terminate();
 socket?.close();
 server.closeAllConnections();
 await new Promise(r=>server.close(r));
 if(browser)await browser.close();
 fs.writeFileSync(path.join(out,"raw.txt"),raw);
}
