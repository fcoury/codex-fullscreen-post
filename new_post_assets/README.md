# Codex CLI goes fullscreen — review package

Open ../new_post_preview.html directly. It contains the rendered article and
inline CSS, and uses only relative assets. It works offline after generation.
The CMS source is ../new_post.md, including standard Markdown GIFs and captions;
post.json holds the header.
Author and publication date are review fields, not a publication claim.

The current draft (formerly V2) is `../new_post.md`. Its media is in
`openai-blog/`; this directory also retains the common preview tools and
templates. From the repository root, rebuild just the current HTML with:

```sh
npm --prefix new_post_assets run preview
open new_post_preview.html
```

R1 is archived separately as `../new_post_r1.md`,
`../new_post_r1_preview.html`, and `../new_post_r1_assets/`. Open the R1
HTML directly to see that version. Rebuilding the current preview does not
change it.

## Build the article and figures

Requirements: Node 24+, Python 3.11+, ffmpeg/ffprobe (GIF encoder). Run from the
repository root:

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

The two article figures keep a dark, low-glare palette in both themes.
build_figures.mjs extracts fullscreen-source.png at 1.75s, during the hero
GIF's first slow PageUps. fig1 overlays its labels on that actual frame;
rebuilding after a new recording refreshes the source image too.

`npm run verify` checks that the article renders without any network requests,
loads all lazy images as a reader scrolls, has meaningful alt text, three
inline GIFs (and static stills for reduced motion), working section links, no
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
side patch. The side GIF shows an example question answered beside the parent,
using a deterministic local provider. It is a UI demonstration, not a measure
of model accuracy or latency.

Each accepted recording replaces a GIF, a reduced-motion WebP still and a small JSON
source receipt in openai-blog/. It keeps the full frame sequence, terminal
output, assertions and clipboard sample in gifs/out/<scenario>/ for review.
Output there is synthetic and gitignored. Failed recordings leave the previous
accepted GIF in place; investigate failed.png and last-screen.txt.

setup_demo.sh resets only a marked, scenario-specific gifs/out/demo-* directory
and refuses unmarked paths and symlinks. It no longer takes an arbitrary path.
The fixture's version comes from CODEX_BIN. The recorder uses a PTY and xterm,
with a dead local provider for hero/copy and an isolated loopback Responses
fixture for side. No production account or conversation history is used.

The shared look, hero timing and copy sequence follow the original GIF notes.
The recorder captures the actual terminal screen continuously at about 60 ms
intervals, then uses the real timestamps and a 128-color palette for the GIF.
It draws a cursor because headless Chromium does not show the system pointer.
The copy recorder selects real text in Codex and requires both plaintext and
HTML on the macOS clipboard. It pastes that HTML into a mock notes window
(the notes window is styled HTML, not an actual Notes application). It restores
the previous **plain-text**
clipboard; do not run it while non-text clipboard contents need to be retained.

## Recording hero and copy on a release build

The current hero and copy GIFs come from an installed release, not a source build.
Hero uses VHS; copy uses record_copy.mjs, because VHS can't drag the mouse.

```sh
brew install vhs gifsicle webp && brew install --cask font-jetbrains-mono
cd new_post_assets/gifs && npm install
export CODEX_BIN=$(readlink -f "$(command -v codex)")   # must be the native binary, not a Node shim; check: $CODEX_BIN --version
export DEMO_ROOT=$(SCENARIO_NAME=hero ./setup_demo.sh) && vhs hero.tape          # out/hero.gif
export DEMO_ROOT=$(SCENARIO_NAME=copy ./setup_demo.sh) && node record_copy.mjs   # out/copy.gif
gifsicle -O3 --lossy=40 --colors 128 out/hero.gif -o ../openai-blog/hero.gif
gifsicle -O3 --lossy=40 --colors 128 out/copy.gif -o ../openai-blog/copy.gif
```

The copy GIF ends by pasting what Codex put on the clipboard twice: the text/plain
Markdown into an editor window, then the text/html into a notes window, both
overlaid on the terminal.

Then refresh the posters (a frame through `cwebp -q 90`), update the version and
frame count in hero.json and copy.json, rebuild the figures (fig1 takes its frame
from gifs/out/hero.gif at 1.75s) and run `npm --prefix new_post_assets run verify`.
common.tape holds the shared look (1200×870, JetBrains Mono 16, line height 1.1);
record_copy.mjs reads it too. The copy recorder writes to the real macOS clipboard
and restores the previous plain text when it exits. Its notes window is dark, like
the one in record.mjs, so the post has no bright panels.

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

- Hero/copy are recorded on the stable codex-cli 0.158.0 (see
  "Recording hero and copy on a release build"), so their session header is the
  boxed card, not #10754's compact banner. Earlier takes (#10754 at a4f03a05f940,
  then 0.159.0-alpha.6) are in this branch's history. fig1, collapsed-output.webp
  and hero-poster.webp are frames from the 0.158.0 hero (1.75s, 1.75s, 2.55s).
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
