#!/bin/bash
# Build an isolated Codex home with a synthetic long session for the recordings.
# Usage: setup_demo.sh DEMO_ROOT
# Nothing here touches ~/.codex. The provider points at a dead local port, so
# Codex needs no sign-in and never calls a model; the tapes only replay history.
set -euo pipefail
root=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
here=$(cd "$(dirname "$0")" && pwd)
rm -rf "$root"
mkdir -p "$root/h/tidepool/src" "$root/demo-home"
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
TOML
python3 "$here/make_demo_session.py" "$root/demo-home" "$root/h/tidepool" >/dev/null
echo "$root"
