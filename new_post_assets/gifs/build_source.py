#!/usr/bin/env python3
"""Build the CLI and Code Mode host, pin both outputs and their build receipt.
Usage: build_source.py CHECKOUT [--target CARGO_TARGET_DIR]
"""
import argparse, hashlib, json, os, subprocess, sys, shutil
from pathlib import Path

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument("checkout", type=Path)
ap.add_argument("--target", type=Path)
a=ap.parse_args()
repo=a.checkout.resolve()
sha=subprocess.check_output(["git","-C",str(repo),"rev-parse","HEAD"],text=True).strip()
if subprocess.check_output(["git","-C",str(repo),"status","--porcelain"],text=True).strip():
    raise SystemExit("Build from a clean, committed source tree.")
os.environ["CODEX_REPO_ROOT"]=str(repo)
sys.path.insert(0,str(repo/"public/scripts"))
from codex_package.targets import TARGET_SPECS,default_target
from codex_package.v8 import resolve_codex_v8_cargo_env
cache=Path.home()/".cache/codex-fullscreen-post"
v8=resolve_codex_v8_cargo_env(TARGET_SPECS[default_target()],cache_root=Path.home()/".cache/codex-package")
target=(a.target or repo/"codex-rs/target").resolve()
env={**os.environ,**v8,"CARGO_TARGET_DIR":str(target),"STABLE_GIT_COMMIT":sha}
subprocess.run(["cargo","build","-p","codex-cli","-p","codex-code-mode-host","--bin","codex","--bin","codex-code-mode-host"],cwd=repo/"codex-rs",env=env,check=True)
dest=cache/"builds"/sha
dest.mkdir(parents=True,exist_ok=True)
hashes={}
for name in ("codex","codex-code-mode-host"):
    src=target/"debug"/name
    if not os.access(src,os.X_OK):
        raise SystemExit(f"Successful build did not produce {src}")
    p=dest/name
    shutil.copy2(src,p)
    with p.open("rb") as f:
        hashes[name]=hashlib.file_digest(f,"sha256").hexdigest()
version=subprocess.check_output([str(dest/"codex"),"--version"],text=True).strip()
(dest/"build.json").write_text(json.dumps({"commit":sha,"checkout":str(repo),"version":version,"sha256":hashes},indent=2)+"\n")
print(dest/"codex")
