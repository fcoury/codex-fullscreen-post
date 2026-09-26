#!/bin/bash
# usage: render.sh <src.html> <out.png> <width> <height> [scale]
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
src="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --force-device-scale-factor="${5:-1}" --window-size="$3,$4" \
  --virtual-time-budget=6000 --screenshot="$2" "file://$src" >/dev/null 2>&1
echo "wrote $2"
