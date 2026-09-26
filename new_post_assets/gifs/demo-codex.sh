#!/bin/bash
# Launch Codex against the demo home. Env: DEMO_ROOT (from setup_demo.sh), CODEX_BIN.
# Starts from a clean environment so the host terminal (tmux, Ghostty, etc.)
# doesn't leak into Codex's terminal detection.
node_dir=$(dirname "$(command -v node 2>/dev/null || echo /usr/bin/node)")
cd "$DEMO_ROOT/h/tidepool" && clear
exec env -i HOME="$DEMO_ROOT/h" CODEX_HOME="$DEMO_ROOT/demo-home" PATH="$node_dir:/usr/bin:/bin:/usr/sbin:/sbin" \
  TERM="${TERM:-xterm-256color}" LANG=en_US.UTF-8 COLORTERM=truecolor \
  "${CODEX_BIN:-codex}" --no-daemon "$@"
