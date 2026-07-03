# Polypus — Launch playbook (global / English, low-effort cadence)

Target: global/English audience. Budget: a few hours/week. Strategy: **prepare one
strong asset, fire one well-aimed launch on the two channels where the wedge lands,
then a light loop to convert the spike into retained stars.** No content grind.

## The wedge (what makes Polypus worth a star)

> Turn **any** model — including local/base models **without native function-calling** —
> into a coding agent you can trust, via engineering scaffolding (emulated XML tool
> protocol + closed-loop verification + plan-first + auto-context).

This is genuinely differentiated. Aider/Cline/Cursor assume a capable, tool-calling
(usually expensive) model. Polypus's angle — *make weak/local/cheap models deliver* —
is native to r/LocalLLaMA's values. Lead with this, not with "another coding agent".

## Reality check on the existing benchmark

`bench/demo/` already exists and is reproducible — great credibility asset. But read
its headline honestly before using it:

- **Correctness: a perfect tie.** Polypus = OpenCode = Aider, 18/18 on the same model.
  → Use as: *"equivalent correctness, proven, not claimed."* Good.
- **Cost/efficiency: Polypus ties OpenCode and is ~25× pricier than Aider.**
  → Do NOT lead with cost. Aider is cheaper because *you* hand it the files; Polypus is
    a real autonomous agent that navigates + verifies. Disclose this honestly (HN rewards it).
- It uses **one model, same across tools** → it's a *harness* comparison, not a
  *cheap-vs-expensive-model* comparison.

**Therefore:** the launch hook is (1) the tool-call-less capability + (2) honest
equivalent-correctness + (3) the transparency story (the benchmark found and fixed real
bugs in Polypus). The "cheap model ≈ expensive model" story needs a *different*
experiment (see `polypus eval` below) — that's the **follow-up** hook, not a blocker.

## Pre-launch checklist (do before posting any link)

- [x] README install → `npm install -g @gaberrb/polypus` (was: git clone + build).
- [ ] **Demo GIF** at top of README — run `vhs docs/demo.tape`, commit `docs/demo.gif`,
      uncomment the `<img>` in README. (Windows fallback if vhs is painful: record a real
      run with ScreenToGif.) A dev-tool README without a GIF loses ~half its visitors.
- [x] **English benchmark writeup.** Created `docs/benchmark-en.html` (mirrors the pt-BR
      page, honest framing) → https://gaberrb.github.io/polypus/benchmark-en.html once GitHub
      Pages redeploys. Cross-linked both ways with `benchmark.html`.
      ⚠️ **Reconcile the model name before promoting:** `benchmark.html` / `benchmark-en.html`
      say `deepseek-v4-flash`, but the stale `bench/demo/README.md` says
      `deepseek/deepseek-chat-v3-0324`. Fix whichever is wrong so the posts match the page.
- [ ] Move "Status: early MVP. Expect rough edges." *below* the demo/bullets, so the
      first thing a visitor sees is proof, not a disclaimer.
- [ ] Tag 3–5 issues `good first issue` — converts lurkers into contributors (contributors
      almost always star and stick).

## Launch sequence (one channel at a time — don't burn both at once)

**Step 1 — r/LocalLLaMA** (warmest crowd for the wedge; more forgiving).
- Post = the *capability + honest benchmark*, not "check out my project".
- Value-first or you get downvoted. Draft below.
- Respond to **every** comment in the first few hours — this is where stars are won.
- Use the feedback to fix 2–3 rough edges before HN.

**Step 2 — Show HN** (days later, with the improved asset + "N people tried it" social proof).
- Plain title, no hype. Draft below.
- Timing: **Tue–Thu, ~9–11am US Eastern.**
- Your first comment = the short honest story. Draft below.

**Long tail (near-zero effort, do anytime):** open PRs adding Polypus to
`awesome-ai-coding`, `awesome-llm-tools`, `awesome-ollama`, `awesome-command-line-apps`
(the TUI angle). Discovery that pays off for months.

## Follow-up hook: `polypus eval` (the "prove the thesis" benchmark)

The strongest future post: same tasks, **cheap/local model on Polypus vs an expensive
model**, showing equivalent correctness at a fraction of the cost — on the *same* harness.
The current benchmark can't claim this (same model across tools). Turning `bench/demo/`
into a shipped `polypus eval <suite>` command (already on the README roadmap) makes this
reproducible by anyone and becomes launch asset #2. Build after the first launch.

## What NOT to do

Buying stars, star-for-star exchanges, "follow-back" rings, dropping links in unrelated
Discords. Doesn't retain anyone and GitHub bans it. A star without retention is vanity.

---

# Ready-to-paste drafts

> Fill the `[…]` placeholders. Keep numbers honest — the benchmark is 6 small tasks on
> one model; don't imply more than it shows.

## Show HN

**Title** (pick one, ≤ 80 chars):
- `Show HN: Polypus – make any LLM (even without tool-calling) code reliably`
- `Show HN: A coding agent that turns local/base models into real coding agents`

**URL:** https://github.com/GaberRB/polypus

**First comment (author intro):**

```
Hi HN — I'm a solo dev and Polypus is my attempt at one idea: most coding agents assume a
strong, tool-calling (usually expensive) model. I wanted my cheap/local models to code too.

So Polypus injects a strict XML tool protocol into the prompt for models that DON'T have
native function-calling, and parses their text output back into real file edits + commands.
Models that do have function-calling just use it natively. On top of that it runs a
closed loop: the agent has to write a short plan, read before it edits, and when it says
"done" Polypus runs your project's own checks (typecheck/test/build/lint) and hands any
failure back to fix — it won't accept "done" until the project is actually green.

I also ran an honest tool-vs-tool benchmark (Polypus vs OpenCode vs Aider, same model,
same tasks, cost measured from the OpenRouter API, not self-reported). Correctness came out
tied; on token efficiency Polypus currently loses to Aider (Aider makes you name the files;
Polypus navigates autonomously and pays for it). The benchmark's real value was that it
found 4 bugs in Polypus, which I fixed. Data + repro scripts are in the repo.

It's an early MVP by one person — bring your own keys (OpenRouter/Ollama/Anthropic/any
OpenAI-compatible endpoint), no telemetry. Would love feedback, especially on the
tool-call emulation for local models.

Benchmark writeup: https://gaberrb.github.io/polypus/benchmark-en.html
Install: npm install -g @gaberrb/polypus
```

## r/LocalLLaMA

**Title:**
`Made local models WITHOUT function-calling work as coding agents — benchmarked correctness vs Aider & OpenCode (same model, same tasks)`

**Body:**

```
A lot of coding agents quietly assume a model with solid native tool-calling. The local /
base models many of us actually run don't always have that — so they fall back to spitting
prose instead of editing files.

I built Polypus to close that gap. For models without native function-calling it injects a
strict XML tool protocol into the system prompt and parses the text back into real edits:

    <polypus:tool name="write_file">
    <arg name="path">src/index.ts</arg>
    <arg name="content">...</arg>
    </polypus:tool>

Models that DO support function-calling use it natively. Either way, it runs a closed loop:
plan-first, read-before-edit, and on "done" it runs your project's real checks
(test/typecheck/build/lint) and won't accept completion until they pass. Works with Ollama
out of the box (no key), OpenRouter, native Anthropic, or any OpenAI-compatible endpoint.
No telemetry — nothing leaves your machine except calls to the provider you configure.

I ran a small, honest benchmark: Polypus vs OpenCode vs Aider, SAME model
(deepseek-v4-flash), same 6 tasks (algorithms, edge cases, a debugging task, a multi-file
"find the bug" task), cost measured from the OpenRouter API with a dedicated key per tool
(not self-reported). Results:

- Correctness: all three tied (18/18 subtests). At this difficulty a strong model solves
  everything — the interesting signal is that the tool-call emulation held up.
- Efficiency: Aider is ~25× cheaper because you tell it which files to edit; Polypus and
  OpenCode are autonomous agents that navigate + verify and pay for it in tokens. Honest
  gap, and it's my current improvement target.

Everything is reproducible (scripts + tasks in the repo). Bugs and all — the benchmark
actually found 4 real bugs in Polypus, which is kind of the point.

Repo: https://github.com/GaberRB/polypus
Benchmark (methodology + numbers): https://gaberrb.github.io/polypus/benchmark-en.html
Install: npm install -g @gaberrb/polypus

Feedback very welcome — especially from anyone running base/instruct models locally that
struggle with tool-calling. Which local models should I test next?
```
```
