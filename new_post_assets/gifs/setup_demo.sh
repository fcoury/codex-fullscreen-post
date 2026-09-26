#!/bin/bash
# Build an isolated Codex home with a synthetic long session for the recordings.
# Usage: setup_demo.sh DEMO_ROOT
# Nothing here touches ~/.codex. The provider points at a dead local port, so
# Codex needs no sign-in and never calls a model; the tapes only replay history.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$here/out"
case "${SCENARIO_NAME:-demo}" in
  demo|hero|copy|side) root="$here/out/demo-${SCENARIO_NAME:-demo}" ;;
  *) echo "Unknown recording scenario" >&2; exit 1 ;;
esac
# Only remove the directory owned by this script. Never accept an arbitrary path.
if [[ -L "$root" || ( -e "$root" && ! -f "$root/.codex-post-demo" ) ]]; then
  echo "Refusing to reset unmarked demo directory: $root" >&2
  exit 1
fi
rm -rf "$root"
mkdir -p "$root/h/tidepool/src" "$root/demo-home"
touch "$root/.codex-post-demo"
(cd "$root/h/tidepool" && git init -q && touch src/lib.rs)
cat > "$root/demo-home/config.toml" <<TOML
model = "gpt-6-sol"
model_provider = "demo"

[model_providers.demo]
name = "OpenAI"
base_url = "http://127.0.0.1:9/v1"
wire_api = "responses"
requires_openai_auth = false

[projects."$root/h/tidepool"]
trust_level = "trusted"

[tui]
screen_reader_detection_done = true
fullscreen_transcript = true
TOML
python3 "$here/make_demo_session.py" "$root/demo-home" "$root/h/tidepool" >/dev/null
echo "$root"
