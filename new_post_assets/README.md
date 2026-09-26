# "Codex CLI goes fullscreen": post package

Status as of 2026-09-26: the draft, static images, both GIFs and the `/side` mockup are done. Recorded with codex-cli 0.159.0-alpha.6, which has the same fullscreen features as 0.157.0.

## Contents

```
new_post.md              the post (Markdown, image links point into new_post_assets/)
new_post_preview.html    local preview styled roughly like developers.openai.com/blog
new_post_assets/
  README.md              this file
  openai-blog/           house-style images for the OpenAI Developer blog (PNG + WebP)
  elsewhere/             dark, terminal-native variants (personal blog, social, release notes)
  index.html             side-by-side gallery of both image sets
  src/                   HTML/CSS sources for every image (a-* = blog, b-* = elsewhere)
  build_figures.sh       re-renders all figures (and regenerates b-* from a-*)
  render.sh              renders one HTML file to PNG with headless Chrome
  build_preview.py       rebuilds new_post_preview.html from new_post.md
  gifs/                  recording scripts for hero.gif and copy.gif (see "Recording the GIFs")
```

Keep `new_post.md`, `new_post_preview.html` and `new_post_assets/` in the same folder so the relative links work.

## Rebuilding

- Requirements: Google Chrome, `cwebp` (`brew install webp`), Python 3. The pages load fonts from Google Fonts, and the preview loads `marked` from jsDelivr, so the build needs a network connection.
- `render.sh` expects Chrome at `/Applications/Google Chrome.app`. Edit the `CHROME=` line on Linux or Windows.
- Figures: `new_post_assets/build_figures.sh`
- Covers (these are rendered separately):
  - `./render.sh src/a-cover.html openai-blog/cover.png 2400 900 1`
  - `./render.sh src/b-cover.html elsewhere/cover.png 1200 630 2`
  - then `cwebp -q 90 openai-blog/cover.png -o openai-blog/cover.webp`
- `/side` mockup:
  - `./render.sh src/side-preview.html openai-blog/side-preview.png 1200 870 1`
  - then `cwebp -q 90 openai-blog/side-preview.png -o openai-blog/side-preview.webp`
- Preview: `python3 new_post_assets/build_preview.py`

## Recording the GIFs

macOS only: the copy recorder uses `pbcopy`, `pbpaste` and `osascript`, and Chrome at `/Applications/Google Chrome.app`.

**One-time setup:**

```
brew install vhs gifsicle webp                # VHS brings ttyd and ffmpeg
brew install --cask font-jetbrains-mono
cd new_post_assets/gifs && npm install        # puppeteer-core for the copy recorder
```

**Record.** Run from `new_post_assets/gifs`. `CODEX_BIN` is the Codex build that gets recorded. Run `setup_demo.sh` again before each recording so every take starts from a clean demo home.

```
cd new_post_assets/gifs
export CODEX_BIN=$(command -v codex)          # check: $CODEX_BIN --version

export DEMO_ROOT=$(./setup_demo.sh "$TMPDIR/codex-gif-demo")
vhs hero.tape                                  # -> out/hero.gif

export DEMO_ROOT=$(./setup_demo.sh "$TMPDIR/codex-gif-demo")
node record_copy.mjs                           # -> out/copy.gif
```

**Check the result** before replacing anything. These write one image per GIF with a frame every second or so:

```
ffmpeg -loglevel error -y -i out/hero.gif -vf "fps=1.2,scale=600:-1,tile=3x4" -frames:v 1 out/hero-sheet.png
ffmpeg -loglevel error -y -i out/copy.gif -vf "fps=1.1,scale=600:-1,tile=3x4" -frames:v 1 out/copy-sheet.png
open out/hero-sheet.png out/copy-sheet.png
```

Look for:
- the composer, status line and hints row visible at the bottom of every frame;
- the hero reaching the first message ("Read through this crate…") before jumping back;
- "Copied … chars to host clipboard" above the composer in the copy GIF, and the pasted paragraph and code block in the notes window.

**Publish.** Compress into `openai-blog/`, and export MP4s in case the CMS prefers video:

```
gifsicle -O3 --lossy=40 --colors 128 out/hero.gif -o ../openai-blog/hero.gif
gifsicle -O3 --lossy=40 --colors 128 out/copy.gif -o ../openai-blog/copy.gif
for g in hero copy; do
  ffmpeg -loglevel error -y -i out/$g.gif -movflags +faststart -pix_fmt yuv420p \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -crf 22 ../openai-blog/$g.mp4
done
```

Then rebuild the preview with `python3 ../build_preview.py`. `out/` is gitignored; only the files in `openai-blog/` are committed. At the last recording, `hero.gif` was 3 MB and `hero.mp4` 1.5 MB.

**What the recordings show, and why:**
- The Codex version is visible: the hero GIF's session header shows `CODEX_BIN`'s version for about 2 seconds at the top of the scroll. The current GIFs were recorded on codex-cli 0.159.0-alpha.6.
- Both GIFs resume a saved session, so the header is the boxed card ("model: / directory:"). The compact banner with a greeting and the blossom only appear on a new session (`app/session_lifecycle.rs`, `app/startup.rs` in openai/codex), and no setting changes that.
- The status line is Codex's default ("GPT-6-Sol default · ~/tidepool"). Status line settings from your own `~/.codex/config.toml` aren't used.

**How it works:**
- `setup_demo.sh` builds an isolated Codex home with a synthetic 42-turn session about a made-up crate (`make_demo_session.py`). Nothing from `~/.codex` is used. The config points at a dead local provider, so Codex needs no sign-in and never calls a model.
- `demo-codex.sh` starts Codex with `--no-daemon` from a clean environment, so the host terminal (tmux, Ghostty) doesn't change terminal detection. With no known terminal, `copy_on_select = "auto"` copies on select, like Terminal.app and iTerm2.
- `record_copy.mjs` exists because VHS can't drag the mouse. It runs Codex in ttyd, drives headless Chrome with puppeteer-core, and assembles the screenshots with ffmpeg. It writes to the real macOS clipboard, then restores the previous plain-text clipboard when it exits, even on failure. It saves what Codex copied to `out/copy-clipboard.{html,txt}`, and the "paste" in the GIF is that real HTML.
- The copy GIF selects the sentence above the code block too, because Codex copies a code-only selection as plain text and adds HTML only when prose is included.
- `common.tape` holds the shared look (about 120×35, JetBrains Mono 16, line height 1.1, dark theme). The copy recorder reads the same settings, so edit them there.

## Image specs

| Asset | Size | Notes |
|---|---|---|
| Blog cover | 2400×900 | Matches recent covers on the blog; no text, no logo |
| Social cover (elsewhere) | 1200×630 @2× | Social link-preview size |
| Figures | 800px canvas @2× (1600px) | Text 15–18px, so readable in a ~700px article column |

## Still to do

1. **Pre-publish checks:**
   - The exact Listerine quote, against the book (*The 22 Immutable Laws of Marketing*, Law of Candor).
   - Copy behavior tested by hand in Ghostty and iTerm2. The GIF was recorded in a browser terminal (ttyd), not a real macOS terminal.
   - The "hold Shift, Fn or Alt/Opt while you drag" line. That bypass is each terminal's own feature, and Codex's code doesn't mention it, so it needs a hand test.
   - Legal and brand review of the book reference and the images. The blog images use Inter and JetBrains Mono because OpenAI Sans wasn't available, so the design team may want to redo the cover.
   - The `/side` mockup, with the team building it. It's labeled as a preview, but the layout is a guess.
2. **Checked against the code (2026-09-26, openai/codex 06f97622f8):**
   - fig1 now matches the real layout: transcript, notices row, composer, status line, then hints as the bottom row. Warnings are a count in that row ("⚠ 1 warning · f2 to view"); <kbd>F2</kbd> or `/warnings` opens them in place of the bottom pane. There is no warnings panel.
   - Collapsed output reads "• Ran cargo test", the last three lines, then "+ Show details". There's no line count.
   - The social cover's placeholder is now the real footer string "↑ Loading earlier messages…".
   - A code-only selection copies as plain text. Codex adds HTML (and Markdown) when the selection includes prose, which is why the copy GIF selects the sentence above the code block too.
3. **Items to raise with the team** (not for the post):
   - **Possible kitty bug:** Codex assumes every kitty on macOS passes Cmd+C to the app, without checking the version. kitty only does this from 0.43, and it was broken in 0.47.0–0.47.1. Users on those versions get neither Cmd+C nor copy-on-select.
   - **Defaults that could be loosened:** VS Code on Linux and Konsole 26.08+ appear to pass the copy key through, but Codex uses copy-on-select for them.
   - **iTerm2 tip:** with Profile > Keys > Command set to "Super", iTerm2 passes Cmd+C to the app. It's untested whether that works with `copy_on_select = "never"`.
   - **Ghostty over SSH:** Codex usually can't tell it's running in Ghostty (the environment variable isn't forwarded), so it falls back to copy-on-select.

## Research notes (for reference)

**How Codex decides, from openai/codex at commit 1a89aec, 2026-09-26**
- The code is in `tui/src/local_settings.rs` (`copy_on_select`) and `terminal-detection/src/lib.rs`.
- The terminal is detected from environment variables only.
- **Copy shortcut keeps working** (copy-on-select off by default): Ghostty ≥ 1.2.0 (only when `TERM_PROGRAM_VERSION` is set), kitty on macOS, Windows Terminal (including WSL), and VS Code on Windows.
- **Copy-on-select on by default:** everything else, and anything inside tmux or Zellij.
- **Copy keys:** Ctrl+C, Super+C and Ctrl+Shift+C, while a selection exists.
- **Clipboard writes:** native clipboard first (HTML plus plain text via arboard). On WSL it falls back to PowerShell. Over SSH or tmux it also sends OSC 52 or uses tmux's `load-buffer`.
- **Config:**
  - `[tui] copy_on_select = "auto" | "always" | "never"`
  - `[tui] fullscreen_transcript = true | false` (this is what `/tui` saves)

**Terminal behavior, from each project's docs and source; nothing was tested by hand**
- **Ghostty:** since 1.2.0 its default copy bindings pass the key to the app when Ghostty itself has no selection.
- **kitty (macOS):** since 0.43 Cmd+C passes through when kitty has no selection.
- **Windows Terminal:** passes the key to the app when it has no selection.
- **Always keep the shortcut for themselves:** iTerm2, Terminal.app, WezTerm, Alacritty, Warp and Zed. Several can be changed in their settings.
- **tmux:** turns Cmd+C into Alt+C, so the app never sees Cmd+C.
