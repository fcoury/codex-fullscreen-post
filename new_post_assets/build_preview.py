#!/usr/bin/env python3
"""Build an offline article preview; --all also regenerates every illustration."""
import argparse
from pathlib import Path
import subprocess

assets = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--all", action="store_true", help="render covers and themed figures first")
args = parser.parse_args()
if args.all:
    subprocess.run(["node", "build_figures.mjs"], cwd=assets, check=True)
subprocess.run(["node", "build_preview.mjs"], cwd=assets, check=True)
