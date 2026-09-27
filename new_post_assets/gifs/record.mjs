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
const cols=name==="side" ? 150 : 120, rows=36, width=cols*10+52, height=870;
const out=path.join(here,"out",name);
fs.mkdirSync(out,{recursive:true});
for (const f of fs.readdirSync(out))if(/^f\d+\.png$/.test(f))fs.unlinkSync(path.join(out,f));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let terminal, browser, client, socket, raw="", fixtureRequests=0, capturing=false, capture;
// The real clipboard is exercised only for the copy scenario. Keep the user's
// existing plain-text clipboard out of files and restore it even on failure.
const previousClipboard=name==="copy" ? execFileSync("pbpaste") : null;
// Shared look from the original GIFs' common.tape.
const theme={background:"#0e0e10",foreground:"#e6e6e6",cursor:"#e6e6e6",selectionBackground:"#3a3a48",
 black:"#1c1c1f",brightBlack:"#6b6b73",red:"#ff6b6b",brightRed:"#ff8787",
 green:"#7bd88f",brightGreen:"#9be9a8",yellow:"#e5c07b",brightYellow:"#f0d399",
 blue:"#6ea8fe",brightBlue:"#8fbcff",magenta:"#c678dd",brightMagenta:"#d69ae6",
 cyan:"#56d4dd",brightCyan:"#7fe3ea",white:"#d6d6d6",brightWhite:"#ffffff"};
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
   const text="No. Jitter only spreads out the refill time. It stays between 0 and 25 ms; "
     + "the configured rate is unchanged. Each shard still receives the same number of tokens per second.";
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
 .bar{height:40px;display:flex;align-items:center;padding:0 14px;gap:8px}
 .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
 .dot:nth-child(1){background:#ff5f58}.dot:nth-child(2){background:#ffbd2e}.dot:nth-child(3){background:#18c132}
 #term{position:absolute;top:40px;left:24px}
 #cursor{position:absolute;left:-50px;top:-50px;width:22px;height:22px;pointer-events:none;z-index:10}
 #doc{position:absolute;right:28px;top:64px;width:600px;opacity:0;transform:translateY(24px);
       transition:opacity .35s,transform .35s;background:#1d1e22;color:#e4e3de;border-radius:12px;
       border:1px solid #34353b;box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;z-index:5;pointer-events:none}
 #doc.show{opacity:1;transform:none}
 #doc .top{height:36px;background:#26272c;border-bottom:1px solid #34353b;display:flex;align-items:center;
       padding:0 14px;font-size:13px;color:#9a9a93;gap:8px}
 #doc .body{padding:22px 28px 26px;font-size:16px;line-height:1.55;min-height:150px}
 #doc h3{margin:0 0 10px;font-size:20px}#doc p{margin:0 0 10px}
 #doc pre{background:#141518;border:1px solid #303137;border-radius:8px;padding:12px 14px;margin:0;
       font:14px/1.5 "JetBrainsMono Nerd Font Mono","JetBrains Mono",monospace;white-space:pre}
 #doc code{font-family:"JetBrainsMono Nerd Font Mono","JetBrains Mono",monospace;color:#93d4c0}
 #doc pre code{color:#e4e3de}
 .caret{display:inline-block;width:2px;height:19px;background:#e4e3de;vertical-align:-4px;animation:b 1s steps(1) infinite}
 @keyframes b{50%{opacity:0}}
 #keys{position:absolute;left:50%;bottom:72px;transform:translateX(-50%);opacity:0;transition:opacity .2s;
       background:rgba(20,20,24,.9);color:#fff;border:1px solid #444;border-radius:10px;padding:8px 16px;
       font:600 20px -apple-system,system-ui;z-index:20}
 </style></head><body><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i></div>
 <div id="term"></div>
 <svg id="cursor" viewBox="0 0 22 22"><path d="M5 2v16l4.2-4 2.8 6.3 2.4-1-2.8-6.2H17z"
   fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></svg>
 <div id="doc"><div class="top"><i class="dot"></i><i class="dot"></i><i class="dot"></i>
 <span style="margin-left:8px">PR description — Notes</span></div>
 <div class="body"><h3>Opt in to refill jitter</h3><div id="payload"><span class="caret"></span></div></div></div>
 <div id="keys">⌘V</div>
 <script src="/term.js"></script><script>
 const t=window.term=new Terminal({cols:${cols},rows:${rows},fontFamily:'"JetBrainsMono Nerd Font Mono","JetBrains Mono",Menlo,monospace',fontSize:16,
 lineHeight:1.1,theme:${JSON.stringify(theme)},cursorBlink:false,allowProposedApi:true,scrollback:1000});
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
 // Wait for fonts before fitting the actual 120/150-column terminal. Keep every
 // bottom row visible and avoid the empty margin from a hard-coded canvas size.
 const box=await page.evaluate(async()=>{
  await document.fonts.ready;
  const r=document.querySelector(".xterm-screen").getBoundingClientRect();
  return {width:Math.ceil(r.right+24),height:Math.ceil(r.bottom+24)};
 });
 await page.setViewport({...box,deviceScaleFactor:1});
 await wait(550);
 const frames=[];
 await page.screenshot({type:"webp",quality:90,path:path.join(out,name+"-poster.webp")});
 capturing=true;
 capture=(async()=>{
  while(capturing){
   const t=Date.now();
   const f=path.join(out,`f${String(frames.length).padStart(4,"0")}.png`);
   await page.screenshot({path:f});
   frames.push({f,t});
   await wait(Math.max(1,60-(Date.now()-t)));
  }
 })();
 async function key(s,ms=140){terminal.write(s);await wait(ms)}
 async function type(s){
  for(const c of s)await key(c,55);
 }
 let cur={x:box.width*.62,y:box.height*.55};
 const setCursor=p=>page.evaluate(({x,y})=>{
  const c=document.getElementById("cursor");
  c.style.left=x-5+"px";c.style.top=y-2+"px";
 },p);
 async function glide(to,ms){
  const steps=Math.max(6,Math.round(ms/30)),from=cur;
  for(let i=1;i<=steps;i++){
   const k=i/steps,e=k<.5?2*k*k:1-(-2*k+2)**2/2;
   const p={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e};
   await page.mouse.move(p.x,p.y);
   await setCursor(p);
   await wait(ms/steps);
  }
  cur=to;
 }
 if(name==="copy")await setCursor(cur);
 await wait(1200);
 if(name==="hero"){
  for(let i=0;i<3;i++)await key("\x1b[5~",450);
  for(let i=0;i<160;i++){
    if((await text()).includes("Read through this crate"))break;
    await key("\x1b[5~",45);
  }
  await until("Read through this crate");
  fs.writeFileSync(path.join(out,"first-screen.txt"),await text());
  await wait(2000);
  await key("\x1b");
  await until("Want me to squash");
  await wait(2500);
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
  await glide({x:geo.x,y:geo.y},700);
  await wait(250);
  await page.mouse.down();
  await glide({x:geo.x2,y:geo.y2},1300);
  await wait(200);
  await page.mouse.up();
  await until("Copied");
  await wait(2200);
  const plain=execFileSync("pbpaste",{encoding:"utf8"});
  const hex=execFileSync("osascript",["-e","the clipboard as «class HTML»"],{encoding:"utf8"});
  const html=Buffer.from(hex.match(/«data HTML([0-9A-F]*)»/)?.[1]||"","hex").toString();
  if(!plain.includes("refill_jitter") || !html.includes("refill_jitter"))throw Error("Expected clipboard text/html absent");
  fs.writeFileSync(path.join(out,"clipboard.txt"),plain);
  fs.writeFileSync(path.join(out,"clipboard.html"),html);
  await glide({x:box.width*.72,y:box.height*.45},500);
  await page.evaluate(()=>document.getElementById("doc").classList.add("show"));
  await wait(900);
  await page.evaluate(()=>document.getElementById("keys").style.opacity=1);
  await wait(450);
  await page.evaluate(h=>{
   const doc=new DOMParser().parseFromString(h,"text/html");
   document.getElementById("payload").replaceChildren(...doc.body.childNodes);
  },html);
  await wait(350);
  await page.evaluate(()=>document.getElementById("keys").style.opacity=0);
  await wait(2400);
 }else{
  await type("/side");await key("\r");
  await wait(1100);
  await type("Does refill jitter change the average rate?");
  await wait(550);
  await key("\r");
  await until("configured rate is unchanged");
  await wait(1600);
  fs.writeFileSync(path.join(out,"split-screen.txt"),await text());
  const s=await text();
  if(!s.includes("refill jitter")||!s.includes("Want me to squash")||!s.includes("│")||fixtureRequests===0)
    throw Error("Side answer, intact parent and divider must be visible in the actual capture");
  // Hold the actual split with the answer visible. No artificial zooms.
  await page.screenshot({type:"webp",quality:90,path:path.join(out,name+"-poster.webp")});
  await key("\x1f"); // Ctrl+/ on a legacy PTY
  await type("Yes, open the PR.");
  await wait(2200);
 }
 capturing=false;
 await capture;
 const list=frames.map(({f,t},i)=>`file '${f}'\nduration ${((frames[i+1]?.t ?? t+100)-t)/1000}`).join("\n")+`\nfile '${frames.at(-1).f}'\n`;
 fs.writeFileSync(path.join(out,"frames.txt"),list);
 const ff=(...args)=>execFileSync("ffmpeg",["-v","error","-y",...args],{stdio:"inherit"});
 const src=["-f","concat","-safe","0","-i",path.join(out,"frames.txt")];
 ff(...src,"-vf","fps=20,split[a][b];[a]palettegen=stats_mode=diff:max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
   "-loop","0",path.join(out,name+".gif"));
 const receipt={commit:build.commit,version:build.version,sha256:build.sha256,columns:cols,rows,fixtureRequests,frames:frames.length,scenario:name};
 fs.writeFileSync(path.join(out,name+".json"),JSON.stringify(receipt,null,2)+"\n");
 // Publish only after the scene assertions and GIF encoder finish.
 for(const suffix of [".gif","-poster.webp",".json"]){
  fs.copyFileSync(path.join(out,name+suffix),path.join(assets,"openai-blog",name+suffix));
 }
 console.log("Recorded",name,receipt.commit,cols,"columns");
}finally{
 capturing=false;
 if(capture)await capture.catch(()=>{});
 if(previousClipboard)execFileSync("pbcopy",{input:previousClipboard});
 if(terminal)terminal.kill();
 if(client)client.terminate();
 socket?.close();
 server.closeAllConnections();
 await new Promise(r=>server.close(r));
 if(browser)await browser.close();
 fs.writeFileSync(path.join(out,"raw.txt"),raw);
}
