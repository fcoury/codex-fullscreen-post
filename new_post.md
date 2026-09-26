# Codex CLI goes fullscreen

<!-- COVER: set as the post's cover image in the CMS if it has a separate field; otherwise keep it here. -->
![A glass-style terminal window framed by fullscreen corner marks, with pages of earlier history stacked above it and the composer pinned at the bottom.](new_post_assets/openai-blog/cover.webp)

In *The 22 Immutable Laws of Marketing*, Al Ries and Jack Trout tell the story of a Listerine ad with an unlikely tagline: *"The taste you hate, twice a day."* It's their example of the Law of Candor. Admit a negative, and people will give you a positive. The ad worked because it said out loud what everyone already knew, and turned it into proof: if it tastes that strong, it must be doing something.

Codex CLI 0.157.0 is our largest update since launch. It changes how selecting and copying text works in your terminal, and you're going to notice. Most of us on the team did. It took a couple of days for the new muscle memory to set in.

We made the change because more and more people use Codex for long sessions. In the new fullscreen view, Codex takes over the whole terminal window, the same way `vim`, `top` or `lazygit` do. It draws and manages the entire screen, including the transcript, the composer and the status line. We can also build things a plain scrolling terminal couldn't handle.

<!-- VISUAL: Hero GIF (~10s). A long session in fullscreen: scroll far back through history, composer stays pinned at the bottom, then jump back to the latest message. -->

## Built for long sessions

When we first built Codex, managing context was a big part of working with the model. You'd often start fresh just to keep a session from getting polluted.

Models have since gotten really good at managing context. Compaction is now rock solid, and with memory in the mix, long sessions no longer need babysitting. Codex has grown from short, focused exchanges into agents that run for long stretches.

The classic view wasn't built for that. It lived inside your terminal's scrollback, so it was bound by limits that vary from terminal to terminal. And because we never knew if or when you'd scroll back, we had to load as much of the conversation as we could up front. The longer the session, the more we loaded, and older history still fell off the top.

![Side-by-side comparison. Classic scrollback: the oldest messages are dropped past the terminal's scrollback limit, everything else is loaded up front, and the prompt scrolls with the history. Fullscreen: history above and below the screen loads on demand, only what you need is loaded, and the composer stays pinned to the screen while you scroll.](new_post_assets/openai-blog/fig2-history.webp)

*Figure 1. The classic view loads the whole conversation up front and loses whatever falls past the scrollback limit. Fullscreen loads history as you scroll to it and keeps the composer in place.*

Sessions open fast however long they get, because Codex loads history as you scroll. You can go all the way back to the start of a session. Reread a plan or an earlier diff, and the composer stays right where it is, ready for your next message.

The classic view could only append lines or redraw the whole screen, so streamed tables and lists had to repaint the entire scrollback as they grew. Thanks to Rust and some careful engineering you rarely felt it, but you could on slow terminals and high-latency SSH connections. Fullscreen redraws exactly what changed.

Parts of Codex, like the command center and the transcript, were already fullscreen. Now everything scrolls, selects and navigates the same way.

![Diagram of the fullscreen view, top to bottom: the transcript, with no scrollback limit and a collapsed block of test output; the warnings panel; hints and shortcuts, just above the composer; the composer, which never scrolls away; and the status line, which stays on screen.](new_post_assets/openai-blog/fig1-anatomy.webp)

*Figure 2. The parts of the fullscreen view.*

- Hints and keyboard shortcuts have their own area, always just above the composer.
- The status line has its own space and stays on screen even when contextual notices appear.
- Warnings move out of the transcript into their own panel, so your conversation stays about your work.
- Diffs and tool output collapse, so those 400 lines of test results are there only when you want them.

## Copy and paste

In fullscreen, Codex handles text selection itself, and that changes a habit you probably use dozens of times a day.

<!-- VISUAL: Short GIF (~5s). Drag to select a code block in the transcript, "Copied" confirmation appears, paste into an editor or doc showing preserved formatting. -->

In Ghostty 1.2+, kitty on macOS, Windows Terminal and VS Code on Windows, your usual copy shortcut keeps working. Most other terminals, including Terminal.app and iTerm2, keep that shortcut for themselves. For those, Codex now copies the moment you finish selecting, so you don't need a shortcut.

![Two groups of terminals. Your copy shortcut keeps working in Ghostty 1.2+, kitty on macOS, Windows Terminal and VS Code on Windows. Codex copies as soon as you select in Terminal.app, iTerm2, Warp, WezTerm, Alacritty, GNOME Terminal, Konsole, kitty on Linux, VS Code on macOS and Linux, and anything inside tmux or Zellij.](new_post_assets/openai-blog/fig3-copy.webp)

*Figure 3. How copying works in each terminal, and how to change it.*

If you'd rather choose for yourself, set `copy_on_select` in the `[tui]` section of your config to `auto` (the default), `always` or `never`.

Codex puts both Markdown and formatted text on your clipboard, so you get clean text in the right format for where you paste. And if you ever need your terminal's own selection, hold <kbd>Shift</kbd>, <kbd>Fn</kbd> or <kbd>Alt</kbd>/<kbd>Opt</kbd> while you drag.

## Where this is going

With control of the whole screen, Codex can put things side by side and update them in place. Each kind of information can have its own space. We're working on a few ways to use that and will share more as they land.

<!-- VISUAL: Early screenshot or mockup of /side running next to the main conversation, clearly labeled "preview". -->

With `/side`, you could ask a quick question in a second conversation next to your main one, without derailing the task in progress. We're also working on a pane alongside the transcript with information about the current conversation, like the side panels in the Codex desktop app. And we're designing richer TUI visualizations of what your agents are doing.

## Give it a fair try

Fullscreen changes habits you've built over years, and the first day can feel off. We'd like you to give it a few days before deciding.

If it still isn't for you, the classic scrollback view is one command away:

1. Run `/tui`.
2. Choose **Scrollback**.
3. Restart Codex.

Your choice is saved for future launches. To come back to fullscreen, run `/tui`, choose **Fullscreen**, and restart. If you manage your config by hand, the same switch is `fullscreen_transcript = false` under `[tui]`.

We're still smoothing out rough edges. Run `/feedback` to tell us what would make fullscreen work for you.
