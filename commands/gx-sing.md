---
description: Sequential driver — take the ONE wave that can start now and work its items one at a time, each merged before the next begins, then stop. The next wave waits for this one to have merged.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`.

# /gx-sing — one wave, worked one item at a time

`/gx-sing` ("**S**equential **I**nteractive **N**ext and **G**o") chains the
inverted `/gx-next` and the `/gx-go` workflow: it plans from the inbox, then
works the wave that can start now, item by item, each one merged before the next
begins. It asks for **no confirmation between stages** — `.gainwix/autonomy.md`
is binding for the run.

## ⛔ The contract — one wave per execution

> *"run only one wave per execution but that one wave will kickoff parallel
> execution paths"*

`/gx-sing` is the serial half of that rule: **same scope as `/gx-ping`, one wave,
but worked one at a time instead of together.**

**The wave behind this one depends on this one having MERGED.** Running on into
it means building on a foundation that is still being written. ⛔ **Being picked
up is not being done.**

⛔ **So `/gx-sing` does not loop until the queues are empty.** It finishes its
wave and **stops**, however much is left. Run it again for the next one.

⚠ **This replaced a loop that ran until both queues were empty.** That behaviour
was wrong, and the paragraph above is why.

**Pipeline reminder:** `.gainwix/<component>/inbox.md` (raw ideas, below the
`<!-- Add action items below this line -->` marker) → **`/gx-next`** (plan the top
raw item into `.gainwix/<component>/backlog.html`) → **`/gx-go`** (execute one
item → PR → `changes/<ts>-change.md` → linked in
`.gainwix/<component>/CHANGELOG.md`).

## ⭐ Read the wave once, at the start

```bash
GX="node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs"
$GX ready
```

**Hold that list for the whole run.** Once an item is moved to `in-progress` it
counts as *taken*, so a second `$GX ready` mid-run will not give the wave back.
Its `next` field is the wave standing behind this one — say it at the start, so
the size of the run is known before it begins.

## The execution

There is one. It is not called an iteration, because nothing repeats.

1. **Plan — run `/gx-next`** (`${CLAUDE_PLUGIN_ROOT}/commands/gx-next.md`) on the
   **top** raw item below the marker in `.gainwix/<component>/inbox.md`: append
   its executable task to `.gainwix/<component>/backlog.html`, remove the
   consumed raw item, and commit + push both to `develop`. If there is no raw
   item, **skip this step.** ⭐ **Planning ships no code**, so it is not bounded
   by the wave — but an item planned now with no dependencies lands in wave 0 and
   may well be built in this same run.

2. **Ask for the wave.** `$GX ready`, captured as above. If `count` is `0`: say
   what is in progress and what it is holding up, and **STOP** — nothing can
   legally start.

3. **Work the wave, one item at a time.** For each item in the captured list, in
   the order the tool gave them (priority, then serial):

   ```bash
   $GX move --id <SERIAL> --to in-progress [--issue <issue-url>]
   ```

   ⚠ **`--issue` is optional and usually absent here.** Pass it only when the
   item already tracks an issue; `/gx-go` does not open one until after its
   tests are green, so at pick-up time there is normally no URL to give. The
   PR link is written on the `completed` move instead.

   then run the `/gx-go` workflow (`${CLAUDE_PLUGIN_ROOT}/commands/gx-go.md`) on
   **that named item** — worktree → build → test → commit → push → PR →
   squash-merge, writing `changes/<ts>-change.md` with the PR/issue links and
   linking it in `.gainwix/<component>/CHANGELOG.md` — and close the loop
   yourself:

   ```bash
   $GX move --id <SERIAL> --to completed --pr-link <pr-url>
   ```

   ⛔ **The driver names the item; it does not let `/gx-go` choose.** `/gx-go`'s
   backlog mode picks the first thing `$GX ready` offers, which is right when a
   person runs it alone and **wrong inside a driver**: an item that failed and
   went back to the backlog is offered again immediately, so the run would
   re-pick the same failure instead of moving on. Same division of labour as
   `/gx-ping`, where the driver moves and the teams build.

   ⛔ **Finish each one before starting the next.** One item in flight at a time
   is the whole difference between this and `/gx-ping`.

4. **STOP, and say what is next.** Run `$GX ready` once more *after* the last
   move — that is the honest answer, and it accounts for anything that came back.
   Print the report and end the run.

   ⛔ **Start nothing else.** Not the next wave, **and not an item from this wave
   that came back after failing** — that one will be sitting right there in the
   step-4 `$GX ready` output, at the same wave number, looking startable. It is
   not. It failed minutes ago for a reason nobody has looked at yet. Retrying it
   is the next run's job.

## Failure handling

- **An item fails to go green or fails to merge** (CI red, conflict):

  1. `$GX move --id <SERIAL> --to backlog`
  2. **Clean up after it** — remove its worktree, and close or clearly park its
     PR. ⚠ **A pushed branch that is left behind collides with the next run**,
     which branches fresh off `origin/develop` under the same name.
  3. Record the error **verbatim** in the report.
  4. **Continue with the rest of the wave.**

  ⛔ **The driver owns that move — `/gx-go` must not also make it.** `/gx-go`'s
  own "if the run fails, put it back" step is for a person running `/gx-go`
  alone. If both do it, the second `$GX move` **exits non-zero** with
  *"already in backlog"*, and a driver that reads any non-zero `$GX` as a Hard
  STOP will abort the whole run over a failure it had already handled correctly.

  ⭐ **Continuing is a change, and two things make it safe.** The old loop stopped
  dead on the first failure because it re-read the *top* of a flat list and would
  have hit the same item forever — the list is captured up front now, so that spin
  is impossible. And a wave's items **do not depend on each other by definition**,
  so one failing says nothing about the next.

  ⚠ **Known gap: nothing remembers why it failed.** The reason goes to the report
  and nowhere else — there is no attempt counter, no backoff, and no note on the
  item. A deterministically broken item will fail the same way on every run until
  a person reads the report and fixes it. **Say so in the report** rather than
  letting it look like bad luck.

- **The whole wave fails — meaning NOT ONE item merged:** stop and surface why.
  ⛔ Do not move on to the next wave to salvage the run. ⭐ This is about the
  count of merges, not the size of the wave: a wave of one whose single item fails
  is a whole wave failing, and ends this way rather than as an ordinary stop.

- **Hard STOP** that cannot be auto-recovered (push rejected, GitHub outage,
  genuinely operator-owned dirty queue files): surface the error verbatim and
  stop the chain. Don't retry blindly.

## Report

```
/gx-sing — wave <N>:

  Planned (inbox → backlog):
    • <title>                 <SERIAL>

  Wave <N> — <K> item(s), in order:
    ✓ <SERIAL>  <title>       PR #<n>  merged @ <sha>   changes/<ts>-change.md
    ✗ <SERIAL>  <title>       <reason verbatim> — returned to the backlog

  Next:  <see the rule below — one line, plus the "and behind it" line if both apply>
```

**Choosing the `Next:` line — read it off the closing `$GX ready`, in this order:**

| Closing `$GX ready` says | Print |
|---|---|
| `wave` is the **same number** you just ran | `wave <N> is unfinished — <K> item(s) came back. Run /gx-sing again to retry.` |
| `wave` is a **higher** number | `wave <N+1> — <M> item(s) ready. Run /gx-sing again.` |
| `count` is `0` and something is in progress | `Nothing can start: <SERIAL> is in progress, holding <SERIAL>.` |
| `count` is `0` and nothing is in progress | `The queue is empty.` |

⭐ **When items came back AND a later wave is otherwise clear, print both** — the
retry line, then `and behind it: wave <N+1> — <M> item(s), once <SERIAL> lands.`
The closing call's `next` field is where that second number comes from. One
number without the other is a half-truth.

⭐ **"Stopped at the wave boundary" and "finished the queue" must never print the
same line.** They are completely different states and the operator acts on them
differently.

## Notes

- **`/gx-sing` vs `/gx-ping`.** Same scope — one wave — different concurrency.
  For a wave of one they are identical. Use `/gx-sing` when the wave's items all
  touch the same files anyway, or to avoid the token cost of parallel teams.
- **No inbox clearing dance.** `/gx-go` never touches
  `.gainwix/<component>/inbox.md`; `/gx-next` consumes from it and commits the
  result. The tree is clean between steps — no recovery needed.
- **Every shipped item gets its own `changes/<ts>-change.md`** via `/gx-go`,
  linked from `.gainwix/<component>/CHANGELOG.md`.
- **One driver at a time.** Don't run a second `/gx-sing`/`/gx-ping` against the
  same `develop` concurrently — they would race the queue files and the tip.
- `/gx-sing` itself asks for no confirmation; `.gainwix/autonomy.md` authorizes
  the branch → test → PR → squash-merge → cleanup loop **for one wave.**
- **Formerly `/ang`.**
