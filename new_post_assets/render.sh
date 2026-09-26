#!/bin/bash
# Render one standalone HTML. Figure builds use build_figures.mjs.
set -euo pipefail
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
src="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
profile="$(mktemp -d "${TMPDIR:-/tmp}/codex-post-render.XXXXXX")"
trap 'rm -rf "$profile"' EXIT
"$CHROME_BIN" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$profile" --force-device-scale-factor="${5:-1}" --window-size="$3,$4" \
  --virtual-time-budget=6000 --screenshot="$2" "file://$src"
test -s "$2"
