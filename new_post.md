# Codex CLI goes fullscreen

Listerine once ran an ad with the tagline *"The taste you hate, twice a day."* It worked because it admitted what everyone already knew and turned it into proof: if it tastes that strong, it must be doing something.

So, in that spirit: Codex CLI 0.157.0 changes how selecting and copying text works in your terminal, and you'll notice. Most of us on the team did.

But the change behind it makes Codex much better at long sessions, which is increasingly what people use it for. It also lets us build features that a plain scrolling terminal can't support.

## What's new

The centerpiece of Codex CLI 0.157.0 is a new fullscreen view, where Codex takes over the whole terminal window, the same way `vim`, `top` or `lazygit` do. Instead of adding to your terminal's scrollback, Codex now draws and manages the entire screen: the transcript, the composer, the status line and everything in between.

![A long Codex session in fullscreen. The view pages up through dozens of turns while the composer stays pinned at the bottom, reaches the start of the session, then jumps back to the latest message.](new_post_assets/openai-blog/hero.gif)

*Scrolling back through a long example session. The composer stays where it is the whole way.*

## Built for long sessions

When we first built Codex, managing context was a big part of working with the model. You'd often start fresh just to keep a session from getting polluted.

That's changed. Models have gotten much better at managing context, compaction is now reliable, and with memory in the mix, long sessions no longer need babysitting. Codex sessions have grown from short, focused exchanges into agents that run for long stretches.

The classic view wasn't built for that. It lived inside your terminal's scrollback, so it was bound by limits that vary from terminal to terminal. And because we never knew if or when you'd scroll back, we had to load as much of the conversation as we could up front. The longer the session, the more we loaded, and older history still fell off the top.

![Two views of the same history. In classic scrollback the terminal holds it: the oldest turns fall past its limit and the prompt can scroll out of view. In fullscreen Codex holds it: earlier turns stay available, the visible ones load as needed, and the composer stays pinned.](new_post_assets/openai-blog/fig2-history.webp)

*Figure 1. In the classic view your terminal holds the history, loads it all up front and drops whatever falls past its limit. In fullscreen, Codex holds it, loads what you scroll to and keeps the composer in place.*

Fullscreen removes those limits:

- Sessions open fast, however long they get. History loads as you scroll to it.
- No scrollback ceiling. Keep scrolling and Codex keeps loading, all the way back to the start of the session.
- Your prompt never scrolls away. Reread a plan or an earlier diff while the composer stays right where it is, ready for your next message.

Streaming is lighter too. The classic view could only append lines or redraw the whole screen, so streamed tables and lists had to repaint the entire scrollback as they grew. Thanks to Rust and some careful engineering you rarely felt it, except on slow terminals. Fullscreen redraws only what changed.

You'll also notice some other changes:

![A real Codex screen after scrolling back. 1 marks the transcript with collapsed tool output, 2 the "Back to bottom" notice, 3 the pinned composer, and 4 the status line and shortcuts.](new_post_assets/openai-blog/fig1-anatomy.webp)

*Figure 2. A frame from the example session. The transcript scrolls; the notice row, composer, status line and shortcuts stay put.*

- Hints and keyboard shortcuts get their own row at the bottom of the screen.
- The status line stays on screen, even when contextual notices appear.
- Warnings move out of the transcript. A count waits in the bottom row, and <kbd>F2</kbd> opens them, so your conversation stays about your work.
- Diffs and tool output collapse, and you can expand them when you need the details.

## The taste you'll notice: copy and paste

In fullscreen, Codex handles text selection itself, and that changes a habit you probably use dozens of times a day.

It also means Codex can copy more than your terminal could. Your terminal only sees characters on a screen, while Codex knows what they are: a paragraph, a list, a code block. When your selection includes prose, Codex puts two versions on your local clipboard: the raw Markdown as plain text, and the same content as formatted HTML. Paste into your code editor, terminal or a text field on a page and you get the raw Markdown, with backticks and code fences intact. Paste into a doc, an email or a chat app and you get real paragraphs, inline code and code blocks.

![Dragging across a reply and its code block in Codex. "Copied 187 chars to host clipboard" appears above the composer. The same copy is then pasted twice: a plain-text editor gets the raw Markdown with backticks and code fences, and a notes app gets a formatted paragraph, inline code and a code block.](new_post_assets/openai-blog/copy.gif)

*Copy-on-select in an example session, then one copy pasted twice: a Markdown editor gets the Markdown, and a notes app gets the formatting.*

In Ghostty 1.2+, kitty on macOS, Windows Terminal and VS Code on Windows, your usual copy shortcut keeps working. Most other terminals, including Terminal.app and iTerm2, keep that shortcut for themselves. For those, Codex copies the moment you finish selecting, so you don't need a shortcut. Inside tmux or Zellij, Codex also copies on select.

Those are the defaults when Codex can tell which terminal you're in. Detection depends on what your terminal reports (Ghostty, for example, has to report its version), and custom keybindings or remote sessions can change which keys reach Codex. If you'd rather choose for yourself, set `copy_on_select` in the `[tui]` section of your config to `auto` (the default), `always` or `never`.

A code-only selection copies as plain text. Over SSH the copy travels through your terminal, so you get the Markdown. And if you ever need your terminal's own selection, use its selection override while you drag; the modifier key varies from terminal to terminal.

Terminals, multiplexers and keybindings vary more than any of us can test, and we've surely missed some setups. If copying doesn't work the way you expect in yours, `/feedback` is the fastest way to tell us, and it's how most of these defaults got fixed.

## Where this is going

Faster long sessions and richer copy and paste are what you get today. The bigger reason we made this change is what it lets us build next.

Now that Codex owns the whole screen, it can put things side by side, update them in place, and give each kind of information its own space. Here are a few things we're building on it.

![Codex keeps the main conversation on the left while a side conversation answers a quick question on the right, each with its own composer.](new_post_assets/openai-blog/side.gif)

*A development preview of `/side`, using an example conversation. The split needs a terminal at least 145 columns wide.*

The first is `/side`, and this time it really is side by side. You can ask a quick question in a second conversation that sits next to your main one, and the task in progress keeps going. In the preview, each conversation has its own composer. Click a pane or press <kbd>Ctrl</kbd>+<kbd>/</kbd> to move between them. On narrower terminals you still see one conversation at a time.

We're also working on a pane that sits next to the transcript and shows information about the current conversation. If you've used the side panels in the Codex desktop app, it's similar, but built for the terminal.

These are early ideas, and they'll change as we build them and hear from you. None of them could work in the classic view.

## Scrollback or fullscreen?

Fullscreen isn't free. Classic scrollback has real strengths, and they're why switching back is one command away. Here's how the two compare:

| | Classic scrollback | Fullscreen |
| --- | --- | --- |
| **History** | Your terminal keeps it, up to its scrollback limit | Codex keeps it, back to the start of the session |
| **Opening a long session** | Loads the whole conversation up front | Loads history as you scroll to it |
| **Scrolling** | Your terminal's scrollbar, wheel and keys; your prompt scrolls away with the history | Wheel, <kbd>PgUp</kbd>/<kbd>PgDn</kbd> and <kbd>Ctrl</kbd>+<kbd>Home</kbd>/<kbd>End</kbd>; the composer stays put |
| **Search** | Your terminal's find | <kbd>F3</kbd> searches the transcript |
| **Selecting and copying** | Your terminal's selection, exactly as it always worked | Codex's selection, with Markdown and formatted text, on select or with your usual shortcut |
| **Mouse** | Belongs to your terminal | Codex uses it to select, expand tool output and open links; your terminal's override gets it back |
| **tmux and other multiplexers** | Their scrollback and copy mode see the whole conversation | They see the current screen; the history lives in Codex |
| **After you quit** | The conversation stays in your terminal | Your terminal goes back to the shell; `codex resume` brings the session back |

If you lean on tmux copy mode, want the conversation left in your terminal after you quit, or just prefer your terminal's own selection everywhere, scrollback may suit you better, and it isn't going away. We think fullscreen is the better fit for long sessions, but that's for you to decide.

## Give it a fair try

We know we're asking a lot. Fullscreen changes habits you've built over years, and the first day can feel off. We also won't have gotten everything right on the first try. So we'd like you to give it a real chance: a few days, not a few minutes. It took most of us a couple of days, and copy-on-select makes the biggest adjustment much smaller.

If it still isn't for you, the classic scrollback view is one command away:

1. Run `/tui`.
2. Choose **Scrollback**.
3. Restart Codex.

Codex remembers your choice for future launches. To come back to fullscreen, run `/tui`, choose **Fullscreen**, and restart. If you manage your config by hand, the same switch is `fullscreen_transcript = false` under `[tui]`.

Whichever view you land on, tell us how it goes. Run `/feedback`. If fullscreen doesn't work for you, we want to know why, because that's what we'll fix next.
