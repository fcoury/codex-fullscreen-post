# Codex CLI goes fullscreen — review package

Open ../new_post_preview.html directly. It contains the rendered article and
inline CSS, and uses only relative assets. It works offline after generation.
The CMS source is ../new_post.md; post.json holds the header and media captions.
Author and publication date are review fields, not a publication claim.

## Build the article and figures

Requirements: Node 24+, Python 3.11+, ffmpeg/ffprobe (H.264, VP9 and GIF
encoders). Run from the repository root:

```sh
cd new_post_assets
npm ci
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/codex-fullscreen-post/browsers" npx playwright-core install chromium-headless-shell
npm run build
npm run verify
```

The isolated Chromium shell renders local files only. It never uses a personal
or managed Chrome profile. Set CHROME_BIN to a compatible headless Chromium if
you already have one. macOS sandboxed assistants may need permission to launch
the isolated renderer outside their sandbox.

`npm run preview` rebuilds the HTML only. `npm run build` renders the cover,
all three figures in light and dark variants, then the preview. Figure WebPs
come directly from Chromium, so cwebp is not required. Light and dark versions
use a-fig.css variables and the same source markup. The b-* figure HTML files
are generated gallery views; edit a-* instead.

`npm run verify` checks that the article renders without any network requests,
loads all lazy images as a reader scrolls, has meaningful alt text, three
non-autoplay videos with posters and controls, working section links, no
horizontal overflow and correct header crop at 390, 768, 1280 and 1440px in
light/dark. Review screenshots are in gifs/out/review/ (not committed).

The figure source is in src/. The copy matrix is now a real table in the post.
fig3-copy remains an optional separate graphic in the gallery, not the source
of the terminal support matrix. Do not duplicate it in the article.

## Source builds and re-recording

Build only clean, committed checkouts. Never build a branch in an ephemeral
worktree. For example, after #10754 merges, create a sibling worktree under
~/code at the intended main commit, then:

```sh
# From the post repository root. This builds both required binaries and verifies
# the Codex release V8 archive + matching bindings for this checkout and target.
python3 new_post_assets/gifs/build_source.py /absolute/path/to/codex-checkout

# Use the absolute binary path printed by build_source.py:
export CODEX_BIN="$HOME/.cache/codex-fullscreen-post/builds/<full-sha>/codex"
node new_post_assets/gifs/record.mjs hero
node new_post_assets/gifs/record.mjs copy
python3 new_post_assets/build_preview.py
```

Optional `--target /absolute/path/to/cargo-target` selects a Cargo target
directory. Only reuse it after its other build has finished. Successful builds
are copied into a SHA-specific directory with build.json. The recorder checks
the CLI and companion host checksums before it launches. `codex-cli 0.0.0`
is the unstamped development version printed by these checkouts; the SHA
identifies the source. Do not claim this is a released build.

For side, build the full stack head or a committed integration of it with the
banner changes. Set CODEX_BIN to that build and run:

```sh
node new_post_assets/gifs/record.mjs side
python3 new_post_assets/build_preview.py
npm --prefix new_post_assets run verify
```

The side recording uses 150 columns, exceeding upstream's 145-column minimum.
The hero/copy recordings use 120 for readability. There is no private 120-column
side patch. Both real composers must contain their own drafts before the side
recording can be accepted. The side clip depicts focus and drafts, not a claim
about a model's response or performance.

Each accepted recording replaces MP4, WebM, GIF, WebP poster and a small JSON
source receipt in openai-blog/. It keeps the full frame sequence, terminal
output, assertions and clipboard sample in gifs/out/<scenario>/ for review.
Output there is synthetic and gitignored. Failed recordings leave the previous
accepted clip in place; investigate failed.png and last-screen.txt.

setup_demo.sh resets only a marked, scenario-specific gifs/out/demo-* directory
and refuses unmarked paths and symlinks. It no longer takes an arbitrary path.
The fixture's version comes from CODEX_BIN. The recorder uses a PTY and xterm,
with a dead local provider for hero/copy and an isolated loopback Responses
fixture for side. No production account or conversation history is used.

The copy recorder selects real text in Codex and requires both plaintext and
HTML on the macOS clipboard. Its small overlay shows that HTML, not a simulated
application paste. It preserves and restores the previous **plain-text**
clipboard; do not run it while non-text clipboard contents need to be retained.

## Native checks on this Mac (2026-09-26)

Both used the source-built banner CLI + Code Mode host at a4f03a05f940.

- iTerm2: selecting prose + code displayed "Copied 187 chars to host clipboard"
  on mouse release, without any copy shortcut.
- Ghostty: Codex kept the selection and showed copy hints; Cmd+C cleared it.
  This confirms the observed selection/shortcut flow on this Mac; no claim
  that every Ghostty version or custom keybinding behaves identically.
- The browser PTY recording confirms formatting for the synthetic sample,
  not any particular native-terminal shortcut behavior. The table describes
  Codex defaults, with explicit qualifications for detection, versions, SSH,
  multiplexers and modified bindings.

To repeat in a real terminal, preserving the terminal's detection variables:
```sh
env CODEX_BIN=/absolute/path/from/build_source.py bash new_post_assets/gifs/native-demo.sh
```

## Status for review

- Hero/copy are from published #10754 at a4f03a05f940, not post-merge main.
- Side is from fcoury/fullscreen-post-side-recording at fd657137e303: #10754
  plus published #9996 at e6245d52f10d and its #10107/#10104 ancestors.
  Both builds completed with matching CLI + host. Only integration conflicts
  and the new retained-pane turn-tip call signature were adjusted.
- The argument-comment lint was attempted for codex-tui on the integration.
  The repo's prebuilt lint uses Rust 1.92-nightly; SQLx 0.9 requires 1.94.
  Touched merge-resolution calls were manually inspected against signatures;
  both added None arguments are marked /*working_tip*/.
- #10754 was still OPEN when this review package was built. Rebuild from main
  after it lands before calling these release recordings.
- Confirm the final author, date and release wording before CMS handoff.
