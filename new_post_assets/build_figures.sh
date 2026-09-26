#!/bin/bash
# Regenerate the dark "elsewhere" variants from the a-* sources and render every figure.
set -e
cd "$(dirname "$0")"
S=src
for f in fig1-anatomy fig3-copy; do sed 's|a-fig.css|b-fig.css|' $S/a-$f.html > $S/b-$f.html; done
sed -e 's|a-fig.css|b-fig.css|' -e 's/#fff1ed/#2a140e/g' -e 's/#fbfcfe/#101117/g' -e 's/"#fff"/"#0d0e12"/g' \
  -e 's/#e3e7ef/#2a2d36/g' -e 's/#dfe3eb/#262932/g' -e 's/#f0f4ff/#131a2b/g' -e 's/#8fa9ee/#7aa2ff/g' \
  -e 's/#ec6a4d/#ff6b4a/g' -e 's/#1b2440/#ece8df/g' -e 's/#5d6682/#8e919c/g' -e 's/#c3cad9/#454a57/g' \
  -e 's/font-family:Inter,sans-serif/font-family:"JetBrains Mono",monospace/' \
  -e 's/\.b{font-size:18px;font-weight:600}/.b{font-size:16.5px;font-weight:700}/' \
  -e 's/\.m{font-size:15.5px;fill:var(--muted)}/.m{font-size:13.5px;fill:var(--muted)}/' \
  -e 's/rx="16"/rx="4"/g; s/rx="10"/rx="4"/g; s/rx="6"/rx="2"/g; s/rx="7"/rx="2"/g' \
  $S/a-fig2-history.html > $S/b-fig2-history.html
# name height
while read name h; do
  ./render.sh $S/a-$name.html openai-blog/$name.png 800 $h 2 >/dev/null
  ./render.sh $S/b-$name.html elsewhere/$name.png 800 $h 2 >/dev/null
  cwebp -quiet -q 90 openai-blog/$name.png -o openai-blog/$name.webp
done <<LIST
fig1-anatomy 690
fig2-history 1160
fig3-copy 780
LIST
echo rendered
