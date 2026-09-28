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
let body = marked.parse(md);
// The scrolling demo plays on request, wherever it sits in the post.
const manualGif = "/hero.gif";
// Standard Markdown images + italic caption remain portable to the CMS.
body = body.replace(/<p>(<img [^>]+>)<\/p>\s*<p><em>((?:(?!<\/p>)[\s\S])*?)<\/em><\/p>/g, (_,img,caption) => {
  const image = img.replace("<img ", '<img loading="lazy" decoding="async" ');
  const src = img.match(/src="([^"]+\.gif)"/)?.[1];
  if (!src) return `<figure>${image}<figcaption>${caption}</figcaption></figure>`;
  const poster = src.replace(/\.gif$/, "-poster.webp");
  if (!fs.existsSync(path.join(root, src)) || !fs.existsSync(path.join(root, poster)))
    throw Error("Missing GIF or reduced-motion still: " + src);
  if (src.endsWith(manualGif)) {
    const still = image.replace(`src="${src}"`, `id="intro-demo" src="${poster}"`);
    return `<figure class="gif gif-manual"><a href="${src}" aria-label="Open full size animation">
    ${still}</a>
    <figcaption><button type="button" class="demo-control" aria-controls="intro-demo" aria-label="Play fullscreen scrolling demo" hidden>▶ Play demo</button>${caption}</figcaption></figure>`;
  }
  return `<figure class="gif"><a href="${src}" aria-label="Open full size animation">
    <picture><source media="(prefers-reduced-motion: reduce)" srcset="${poster}">${image}</picture></a>
    <figcaption>${caption}</figcaption></figure>`;
});
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
