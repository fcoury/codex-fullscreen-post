# "Codex CLI goes fullscreen": post package

Status as of 2026-09-26: the full draft and static images are done. The GIF recordings wait on the release with the final changes.

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
- Preview: `python3 new_post_assets/build_preview.py`

## Image specs

| Asset | Size | Notes |
|---|---|---|
| Blog cover | 2400×900 | Matches recent covers on the blog; no text, no logo |
| Social cover (elsewhere) | 1200×630 @2× | Social link-preview size |
| Figures | 800px canvas @2× (1600px) | Text 15–18px, so readable in a ~700px article column |

## Still to do

1. **GIFs**, after the release is out. Record with VHS, using the same theme, font and terminal size (about 120×35) for each, and keep each under about 10 seconds.
   - **Hero** (in "What's new"): a long session. Scroll far back while the composer stays pinned, then jump back to the latest message.
   - **Copy-on-select** (in the copy section): select a code block, show the "Copied" confirmation, then paste into an editor with the formatting intact.
   - **`/side` preview** (in "Where this is going"): label it clearly as a preview.
2. **Check fig1 against the real UI.** The positions of the warnings panel and the status line are guesses. "ran tests · 400 lines" and the "12,408 earlier lines" on the social cover are placeholders.
3. **Pre-publish checks:**
   - The exact Listerine quote, against the book (*The 22 Immutable Laws of Marketing*, Law of Candor).
   - Copy behavior tested by hand in Ghostty and iTerm2.
   - Legal and brand review of the book reference and the images. The blog images use Inter and JetBrains Mono because OpenAI Sans wasn't available, so the design team may want to redo the cover.
   - The `copy_on_select` values and the terminal list, against the shipping version.
4. **Items to raise with the team** (not for the post):
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
