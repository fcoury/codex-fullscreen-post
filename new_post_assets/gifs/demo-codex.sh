#!/bin/bash
# Launch Codex against the demo home. Env: DEMO_ROOT (from setup_demo.sh), CODEX_BIN.
# Starts from a clean environment so the host terminal (tmux, Ghostty, etc.)
# doesn't leak into Codex's terminal detection.
node_dir=$(dirname "$(command -v node 2>/dev/null || echo /usr/bin/node)")
: "${CODEX_BIN:?Set CODEX_BIN to the codex binary to record}"
: "${DEMO_ROOT:?Run setup_demo.sh first}"
test -f "$DEMO_ROOT/.codex-post-demo" || exit 1
# Source builds need their Code Mode host alongside; release installs bundle it.
if [[ "$CODEX_BIN" == */codex-fullscreen-post/builds/* ]]; then test -x "$(dirname "$CODEX_BIN")/codex-code-mode-host" || exit 1; fi
cd "$DEMO_ROOT/h/tidepool" && clear
exec env -i HOME="$DEMO_ROOT/h" CODEX_HOME="$DEMO_ROOT/demo-home" PATH="$node_dir:/usr/bin:/bin:/usr/sbin:/sbin" \
  TERM="${TERM:-xterm-256color}" LANG=en_US.UTF-8 COLORTERM=truecolor \
  "$CODEX_BIN" --no-daemon --disable realtime_conversation "$@"
