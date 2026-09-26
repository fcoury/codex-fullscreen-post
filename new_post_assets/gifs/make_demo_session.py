#!/usr/bin/env python3
"""Write a long synthetic Codex session for the GIF recordings.

Usage: make_demo_session.py CODEX_HOME PROJECT_DIR

Creates CODEX_HOME/sessions/YYYY/MM/DD/rollout-...-<uuid>.jsonl and prints the
session UUID. The session is a made-up day of work on a small Rust crate
("tidepool", a token-bucket rate limiter), so no real session content ends up
in a recording.
"""
import datetime as dt
import json
import os
import sys
import uuid
import subprocess

codex_home, project = sys.argv[1], os.path.abspath(sys.argv[2])
sid = str(uuid.uuid4())
start = dt.datetime(2026, 9, 24, 9, 12, 0, tzinfo=dt.timezone.utc)
clock = [start]
lines = []
ordinal = [0]
item_no = [0]


def ts(step=7):
    clock[0] += dt.timedelta(seconds=step)
    return clock[0].strftime("%Y-%m-%dT%H:%M:%S.000Z")


def ms():
    return int(clock[0].timestamp() * 1000)


def emit(kind, payload, step=7):
    lines.append({"timestamp": ts(step), "ordinal": ordinal[0], "type": kind, "payload": payload})
    ordinal[0] += 1


def item(turn, body, step=7):
    item_no[0] += 1
    body = {"id": f"item-{item_no[0]}", **body}
    emit("event_msg", {"type": "item_completed", "thread_id": sid, "turn_id": turn,
                       "item": body, "completed_at_ms": ms()}, step)


def user(turn, text):
    emit("response_item", {"type": "message", "role": "user",
                           "content": [{"type": "input_text", "text": text}]}, 40)
    item(turn, {"type": "UserMessage",
                "content": [{"type": "text", "text": text, "text_elements": []}]}, 1)


def say(turn, text, final=False):
    emit("response_item", {"type": "message", "role": "assistant",
                           "content": [{"type": "output_text", "text": text}]}, 1)
    item(turn, {"type": "AgentMessage", "content": [{"type": "Text", "text": text}],
                "phase": "final_answer" if final else "commentary"})


def run(turn, cmd, output, code=0, secs=2):
    item(turn, {
        "type": "CommandExecution", "command": ["bash", "-lc", cmd],
        "cwd": "file://" + project, "parsed_cmd": [{"type": "unknown", "cmd": cmd}],
        "source": "agent", "status": "completed" if code == 0 else "failed",
        "stdout": output, "stderr": "", "aggregated_output": output, "exit_code": code,
        "duration": {"secs": secs, "nanos": 0}, "formatted_output": output,
    }, secs)


def edit(turn, changes):
    item(turn, {"type": "FileChange", "status": "completed", "stdout": "",
                "changes": {os.path.join(project, p): {"type": "update", "unified_diff": d,
                                                       "move_path": None}
                            for p, d in changes.items()}})


def turn(n, prompt, body):
    tid = f"turn-{n}"
    emit("event_msg", {"type": "task_started", "turn_id": tid, "model_context_window": 400000,
                       "started_at": ms() // 1000, "collaboration_mode_kind": "default"}, 30)
    user(tid, prompt)
    last = body(tid)
    emit("event_msg", {"type": "task_complete", "turn_id": tid, "last_agent_message": last,
                       "started_at": ms() // 1000, "completed_at": ms() // 1000,
                       "duration_ms": 42000, "time_to_first_token_ms": 900}, 2)


def test_output(n_tests, failures=()):
    out = [f"   Compiling tidepool v0.4.0 ({project})",
           "    Finished `test` profile [unoptimized + debuginfo] target(s) in 3.41s",
           "     Running unittests src/lib.rs (target/debug/deps/tidepool-3f9c2a1e)", "",
           f"running {n_tests} tests"]
    mods = ["bucket", "clock", "refill", "limiter", "config", "metrics", "shard", "burst"]
    for i in range(n_tests):
        name = f"{mods[i % len(mods)]}::tests::case_{i:03d}"
        out.append(f"test {name} ... {'FAILED' if i in failures else 'ok'}")
    ok = n_tests - len(failures)
    out += ["", f"test result: {'FAILED' if failures else 'ok'}. {ok} passed; {len(failures)} failed; "
            f"0 ignored; 0 measured; 0 filtered out; finished in 0.84s", ""]
    return "\n".join(out)


def diff(path, hunk):
    """Build a unified diff whose @@ counts match the body (the TUI parses it strictly)."""
    header, body = hunk.split("\n", 1)
    rows = body.rstrip("\n").split("\n")
    old = sum(1 for r in rows if not r.startswith("+"))
    new = sum(1 for r in rows if not r.startswith("-"))
    start = int(header.split()[1][1:].split(",")[0])
    tail = header.split("@@", 2)[2]
    return (f"--- a/{path}\n+++ b/{path}\n@@ -{start},{old} +{start},{new} @@{tail}\n"
            + "\n".join(rows) + "\n")


# ---- the session -----------------------------------------------------------

emit("session_meta", {
    "session_id": sid, "id": sid, "timestamp": ts(0), "cwd": project, "originator": "codex",
    "cli_version": subprocess.check_output([os.environ["CODEX_BIN"], "--version"], text=True).strip().removeprefix("codex-cli "), "source": "cli", "thread_source": "user",
    "model_provider": "demo", "history_mode": "paginated",
    "git": {"branch": "refill-jitter", "commit_hash": "4be1c09d2e7a55f0b3c8e61d9a0f2c7b5e13a8d4"},
}, 0)

turn(1, "Read through this crate and give me a map of how a request flows through the limiter.",
     lambda t: (
         say(t, "I'll start with the crate layout and the public entry points."),
         run(t, "ls src && wc -l src/*.rs",
             "bucket.rs\nclock.rs\nconfig.rs\nlib.rs\nlimiter.rs\nmetrics.rs\nrefill.rs\nshard.rs\n"
             "  212 src/bucket.rs\n   88 src/clock.rs\n  164 src/config.rs\n   41 src/lib.rs\n"
             "  318 src/limiter.rs\n  126 src/metrics.rs\n  149 src/refill.rs\n  201 src/shard.rs\n"
             " 1299 total"),
         say(t, "Here's the path a single `acquire` call takes:\n\n"
                "1. `Limiter::acquire` hashes the key and picks a shard (`shard.rs`).\n"
                "2. The shard locks its bucket map and creates a bucket on first use.\n"
                "3. `Bucket::try_take` asks `refill.rs` how many tokens accrued since the last call.\n"
                "4. If enough tokens exist it decrements and returns `Permit`; otherwise it returns "
                "`RetryAfter` with the wait time.\n"
                "5. `metrics.rs` records the outcome on the way out.\n\n"
                "| Module | Owns |\n|---|---|\n| `limiter.rs` | public API, key hashing |\n"
                "| `shard.rs` | lock striping, bucket lifecycle |\n| `bucket.rs` | token math |\n"
                "| `refill.rs` | elapsed-time → tokens |\n| `clock.rs` | monotonic clock trait |\n"
                "| `metrics.rs` | counters and histograms |", True))[-1] or "map")

MODULES = ["refill", "shard", "bucket", "clock", "metrics", "config", "limiter", "burst"]
TEMPLATES = [
    ("Add jitter to `{m}.rs` so shards don't all wake on the same tick.", "jitter"),
    ("The errors in `{m}.rs` are stringly typed. Give them a real enum.", "errors"),
    ("Add property tests for `{m}.rs`.", "proptest"),
    ("Why does `{m}.rs` allocate on the hot path? Fix it if it's easy.", "alloc"),
    ("Document the public items in `{m}.rs`.", "docs"),
]


def topic_body(t, m, kind, tests, fails):
    say(t, f"I'll read `src/{m}.rs` and its callers first.")
    run(t, f"rg -n \"pub fn|impl \" src/{m}.rs | head -20",
        "\n".join(f"src/{m}.rs:{12 + 9 * i}:    pub fn {fn}(&{mut}self{args}) -> {ret} {{"
                  for i, (fn, mut, args, ret) in enumerate([
                      ("new", "", ", cfg: &Config", "Self"), ("try_take", "mut ", ", now: Instant", "Take"),
                      ("refill", "mut ", ", now: Instant", "u32"), ("capacity", "", "", "u32"),
                      ("reset", "mut ", "", "()")])), secs=1)
    hunks = {
        "jitter": ("-    let next = state.last + cfg.interval;\n"
                   "+    let jitter = cfg.jitter.sample(&mut state.rng).min(cfg.interval / 4);\n"
                   "+    let next = state.last + cfg.interval + jitter;\n"),
        "errors": ("-pub fn try_take(&mut self, now: Instant) -> Result<Permit, String> {\n"
                   "+pub fn try_take(&mut self, now: Instant) -> Result<Permit, TakeError> {\n"),
        "proptest": ("+proptest! {\n+    #[test]\n+    fn never_exceeds_capacity(ops in ops_strategy()) {\n"
                     "+        let mut b = Bucket::new(&Config::default());\n"
                     "+        for op in ops { b.apply(op); prop_assert!(b.tokens() <= b.capacity()); }\n"
                     "+    }\n+}\n"),
        "alloc": ("-    let keys: Vec<Key> = self.map.keys().cloned().collect();\n"
                  "-    for key in keys {\n+    for key in self.map.keys() {\n"),
        "docs": ("+/// Returns how many tokens are available at `now`, without taking any.\n"
                 "+///\n+/// This never blocks and never mutates the bucket.\n"),
    }
    edit(t, {f"src/{m}.rs": diff(f"src/{m}.rs",
                                 f"@@ -41,6 +41,8 @@ impl {m.capitalize()} {{\n     // ...\n" + hunks[kind])})
    run(t, "cargo test", test_output(tests, fails), code=1 if fails else 0, secs=6)
    if fails:
        say(t, "One test assumed wakeups land exactly on the interval. I'll give it a tolerance.")
        edit(t, {f"src/{m}.rs": diff(f"src/{m}.rs",
            "@@ -140,3 +140,3 @@ mod tests {\n"
            "-        assert_eq!(state.last, start + cfg.interval * 3);\n"
            "+        assert!(state.last.duration_since(start) >= cfg.interval * 3);\n")})
        run(t, "cargo test", test_output(tests), secs=6)
    summaries = {
        "jitter": (f"Done. `{m}.rs` now adds up to a quarter interval of jitter, and all {tests} tests pass.\n\n"
                   "```rust\npub struct JitterRange {\n    pub min: Duration,\n    pub max: Duration,\n}\n\n"
                   "impl Default for JitterRange {\n    fn default() -> Self {\n"
                   "        Self { min: Duration::ZERO, max: Duration::from_millis(25) }\n    }\n}\n```\n\n"
                   "The default caps jitter at 25 ms, so the average rate doesn't change."),
        "errors": (f"`{m}.rs` now returns `TakeError` instead of `String`:\n\n"
                   "| Variant | When |\n|---|---|\n| `Exhausted { retry_after }` | no tokens left |\n"
                   "| `TooLarge { requested, capacity }` | request exceeds capacity |\n"
                   "| `Closed` | limiter was shut down |\n\n"
                   f"Callers in `limiter.rs` match on the variant now. All {tests} tests pass."),
        "proptest": (f"Added three property tests for `{m}.rs`. They check that tokens never exceed capacity, "
                     f"that refills are monotonic, and that `reset` restores the initial state. {tests} tests pass."),
        "alloc": (f"Yes. `{m}.rs` cloned every key into a `Vec` before iterating. It now iterates the map "
                  f"directly, which removes one allocation per call. All {tests} tests pass."),
        "docs": (f"Documented every public item in `{m}.rs`, with a runnable example on the type:\n\n"
                 "```rust\nlet limiter = Limiter::new(Config::per_second(100));\n"
                 "match limiter.acquire(\"user:42\") {\n    Take::Permit(_) => serve(),\n"
                 "    Take::RetryAfter(wait) => reject(wait),\n}\n```"),
    }
    say(t, summaries[kind], True)
    return summaries[kind]


n = 2
for i, m in enumerate(MODULES):
    for j, (prompt, kind) in enumerate(TEMPLATES):
        tests = 64 + 2 * i
        fails = (17,) if kind == "jitter" and i % 3 == 0 else ()
        turn(n, prompt.format(m=m),
             lambda t, m=m, kind=kind, tests=tests, fails=fails: topic_body(t, m, kind, tests, fails))
        n += 1


def last_body(t):
    say(t, "I'll check what's left before opening the PR.")
    run(t, "git status --short && git log --oneline -3",
        " M src/config.rs\n M src/refill.rs\n M src/metrics.rs\n M README.md\n"
        "9c1d2e4 refill: cap jitter at a quarter interval\n"
        "71ab0f3 config: add refill_jitter\n4be1c09 bench: 16-thread acquire contention", secs=1)
    msg = ("Everything's committed except the README and metrics tweaks from this last pass. "
           "Tests pass, the contention benchmark is within 2% of main, and the new "
           "`refill_jitter` option defaults to 0–25 ms.\n\n"
           "For the PR description, this is the `[limiter]` config a service needs to opt in:\n\n"
           "```toml\n[limiter]\nrate = 100          # tokens per second\nburst = 20\n"
           "refill_jitter = { min = \"0ms\", max = \"25ms\" }\n```\n\n"
           "Want me to squash these into one commit and open the PR?")
    say(t, msg, True)
    return msg


turn(n, "Where are we? Summarize what's left before I open the PR.", last_body)

path = os.path.join(codex_home, "sessions", "2026", "09", "24",
                    f"rollout-2026-09-24T09-12-00-{sid}.jsonl")
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    for line in lines:
        f.write(json.dumps(line) + "\n")
print(sid)
