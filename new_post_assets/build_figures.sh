#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node build_figures.mjs
