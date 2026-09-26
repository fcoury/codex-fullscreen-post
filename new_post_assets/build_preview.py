#!/usr/bin/env python3
"""Render ~/Documents/new_post.md into new_post_preview.html (run after edits)."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
docs = os.path.dirname(here)
md = open(os.path.join(docs, "new_post.md")).read()
html = r'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Post preview</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
 body{margin:0;background:#000;color:#e8e8e8;font:17px/1.7 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
 article{max-width:760px;margin:0 auto;padding:48px 16px 96px}
 .note{font-size:13px;color:#888;border:1px dashed #333;border-radius:8px;padding:8px 12px;margin-bottom:32px}
 h1{font-size:40px;line-height:1.15;font-weight:600;letter-spacing:-.02em;margin:0 0 28px;color:#fff}
 h2{font-size:26px;font-weight:600;margin:48px 0 12px;color:#fff}
 p,li{color:#d6d6d6} strong{color:#fff} a{color:#fff}
 img{display:block;width:100%;height:auto;border-radius:14px;margin:28px 0 10px}
 p:has(> img:only-child){margin:0}
 p:has(> img:only-child) + p > em:only-child{display:block;text-align:center;font-style:normal;font-size:14px;color:#777;margin:0 0 28px}
 code{font-family:"JetBrains Mono",monospace;font-size:.86em;background:#1b1b1b;border:1px solid #2a2a2a;border-radius:6px;padding:1px 6px}
 kbd{font-family:"JetBrains Mono",monospace;font-size:.8em;border:1px solid #444;border-bottom-width:2px;border-radius:5px;padding:0 5px}
 .todo{border:1.5px dashed #6b5cff;background:#120f26;color:#b8adff;border-radius:12px;padding:14px 16px;font-size:14px;margin:24px 0}
 .todo b{color:#d8d0ff}
</style></head><body><article>
<div class="note">Local preview of new_post.md, styled roughly like the OpenAI Developer blog. Regenerate with new_post_assets/build_preview.py after edits.</div>
<div id="c"></div></article>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script>
const md=__MD__;
const withTodos=md.replace(/<!--\s*(VISUAL[^:]*|COVER):\s*([\s\S]*?)-->/g,(m,k,t)=>`<div class="todo"><b>${k}:</b> ${t.trim()}</div>\n\n`);
document.getElementById("c").innerHTML=marked.parse(withTodos);
</script></body></html>'''
open(os.path.join(docs, "new_post_preview.html"), "w").write(html.replace("__MD__", json.dumps(md)))
print("wrote", os.path.join(docs, "new_post_preview.html"))
