#!/bin/bash
# Run the pinned example in a real terminal without stripping its identity.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
: "${CODEX_BIN:?Pass the path from build_source.py}"
test -x "$(dirname "$CODEX_BIN")/codex-code-mode-host"
export SCENARIO_NAME=demo
export DEMO_ROOT
DEMO_ROOT="$("$here/setup_demo.sh")"
cd "$DEMO_ROOT/h/tidepool"
HOME="$DEMO_ROOT/h" CODEX_HOME="$DEMO_ROOT/demo-home" \
  "$CODEX_BIN" --no-daemon --disable realtime_conversation resume --last
