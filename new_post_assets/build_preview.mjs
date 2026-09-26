import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const assets = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(assets);
const post = JSON.parse(fs.readFileSync(path.join(assets, "post.json"), "utf8"));
const md = fs.readFileSync(path.join(root, "new_post.md"), "utf8");
const esc = s => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[c]);
const slug = s => s.toLowerCase().replace(/<[^>]*>/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const sections = [];
const renderer = new marked.Renderer();
renderer.heading = (text, level) => {
  if (level === 1) return "";
  const id = slug(text);
  if (level === 2) sections.push({id,text});
  return `<h${level} id="${id}">${text}</h${level}>\n`;
};
renderer.table = (head, body) => `<div class="table-scroll" tabindex="0"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
marked.setOptions({renderer, gfm:true});
function media(name) {
  const m = post.media[name];
  if (!m) throw Error("Unknown MEDIA key: " + name);
  const prefix = `new_post_assets/openai-blog/${m.stem}`;
  const exists = ext => fs.existsSync(path.join(root, prefix + ext));
  if (!exists(".mp4")) {
    return `<figure class="pending"><p>${esc(m.alt)}</p><figcaption>${esc(m.caption)} Recording pending source build.</figcaption></figure>`;
  }
  const poster = exists("-poster.webp") ? ` poster="${prefix}-poster.webp"` : "";
  const provenance = exists(".json")
    ? JSON.parse(fs.readFileSync(path.join(root,prefix + ".json"),"utf8"))
    : null;
  const receipt = provenance ? ` Recorded with ${esc(provenance.version)}, source ${esc(provenance.commit.slice(0,12))}.` : " Existing recording; source refresh pending.";
  return `<figure aria-label="${esc(m.alt)}"><video controls playsinline preload="metadata"${poster}
    aria-label="${esc(m.alt)}">${exists(".webm") ? `<source src="${prefix}.webm" type="video/webm">` : ""}
    <source src="${prefix}.mp4" type="video/mp4">
    ${exists(".gif") ? `<a href="${prefix}.gif">View animated GIF: ${esc(m.alt)}</a>` : esc(m.alt)}</video>
    <figcaption>${esc(m.caption + receipt)}</figcaption></figure>`;
}
const input = md.replace(/<!--\s*MEDIA:\s*([\w-]+)\s*-->/g, (_, name) => media(name));
let body = marked.parse(input);
// Standard Markdown images + italic caption remain portable to the CMS.
body = body.replace(/<p>(<img [^>]+>)<\/p>\s*<p><em>([^<]*)<\/em><\/p>/g,
  (_,img,caption) => `<figure>${img.replace("<img ", '<img loading="lazy" decoding="async" ')}<figcaption>${caption}</figcaption></figure>`);
const tmpl=fs.readFileSync(path.join(assets,"src/preview.html"),"utf8");
const css=fs.readFileSync(path.join(assets,"src/preview.css"),"utf8");
const fields = {
  TITLE:esc(post.title), DECK:esc(post.description), AUTHOR:esc(post.author), DATE:esc(post.date),
  CATEGORY:esc(post.category), COVER:esc(post.cover), COVER_ALT:esc(post.coverAlt),
  CSS:css, BODY:body, TOC:sections.map(({id,text}) => `<a href="#${id}">${text}</a>`).join("\n")
};
const result=tmpl.replace(/@@([A-Z_]+)@@/g, (_,key) => {
  if (!(key in fields)) throw Error("Missing template field " + key);
  return fields[key];
});
fs.writeFileSync(path.join(root,"new_post_preview.html"),result);
console.log("Built new_post_preview.html (offline, " + sections.length + " sections)");
