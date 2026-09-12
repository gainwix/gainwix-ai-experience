---
description: Sequential loop — plan the top inbox idea, run it end to end, repeat until nothing can start. One item at a time, each merged before the next begins.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-sing — sequential interactive /gx-next + /gx-go

`/gx-sing` ("**S**equential **I**nteractive **N**ext and **G**o") chains the
inverted `/gx-next` and the `/gx-go` workflow into one loop: it takes the next item
from the top, works it end-to-end, then comes back for more once it's done. It
runs with **no confirmation prompts between stages**, under the
`### Autonomy preamble (read first)` in the backlog (`.gainwix/<component>/backlog.html`) (read by both `/gx-next` and
`/gx-go`) — make reasonable assumptions and proceed end-to-end.

**Pipeline reminder:** `.gainwix/<component>/inbox.md` (raw-idea inbox, below the
`<!-- Add action items below this line -->` marker) → **`/gx-next`** (plan the top
raw item → append a task to the backlog (`.gainwix/<component>/backlog.html`)) → **`/gx-go`** (execute the top
the backlog (`.gainwix/<component>/backlog.html`) task → ship the PR + record `changes/<ts>-change.md` + link it in
`.gainwix/<component>/CHANGELOG.md`). `/gx-sing` drives both, repeatedly, until both queues are empty.

## One iteration

1. **Plan — run `/gx-next`** (`${CLAUDE_PLUGIN_ROOT}/commands/gx-next.md`): if there is a raw `- `
   item below the `<!-- Add action items below this line -->` marker in
   `.gainwix/<component>/inbox.md`, run the full `/gx-next` workflow — plan the **top** raw item,
   append the executable task to `## Backlog Items` in the backlog (`.gainwix/<component>/backlog.html`), remove the
   consumed raw item from `.gainwix/<component>/inbox.md`, and commit + push both files to
   `develop`. If there is **no** raw item below the marker, **skip `/gx-next`** this
   iteration.
2. **Execute — run `/gx-go`** (`${CLAUDE_PLUGIN_ROOT}/commands/gx-go.md`) in **backlog mode**: if
   there is a `- ` task under `## Backlog Items` in the backlog (`.gainwix/<component>/backlog.html`), run the full
   `/gx-go` workflow — execute the **top** task end-to-end (worktree → build →
   test → commit → push → PR → squash-merge), write `changes/<ts>-change.md`
   (with the GitHub PR/issue links, timeline, session info, Tokens-or-Tools,
   elapsed), append a link to `.gainwix/<component>/CHANGELOG.md`, and remove the executed task from
   the backlog (`.gainwix/<component>/backlog.html`) as part of the task's PR. If there are **no** tasks under
   `## Backlog Items`, **skip `/gx-go`** this iteration.
3. If **both** stages were skipped (nothing to plan AND nothing to execute) →
   both queues are drained: print the final roll-up (below) and STOP.

> One iteration ships at most one PR (from `/gx-go`). `/gx-next` appends to the bottom
> of the backlog (`.gainwix/<component>/backlog.html`) and `/gx-go` takes the top, so the two queues drain FIFO over
> successive iterations — it doesn't matter if the backlog (`.gainwix/<component>/backlog.html`) already had tasks.

## Auto-loop

After each iteration, re-evaluate and repeat — **no prompts** — until BOTH:

- `.gainwix/<component>/inbox.md` has no `- ` item below the marker, AND
- the backlog (`.gainwix/<component>/backlog.html`) has no `- ` item under `## Backlog Items`.

There is no parallel/cluster dispatch and no hard iteration cap. `/gx-sing` is
strictly serial: plan one, execute one, repeat. The expected termination is
"both queues empty." The operator can Ctrl-C at any point; re-invoking `/gx-sing`
resumes draining from the current state (each `/gx-go` task is its own worktree +
PR, so a partial run leaves a consistent repo).

## Failure handling

- **`/gx-go` task fails to merge** (CI red, conflict, etc.): record it in the
  roll-up with the error verbatim, leave that task in the backlog (`.gainwix/<component>/backlog.html`), and — because
  it would just fail again on the next top-read — **STOP** rather than spin.
  Surface it so the operator can fix or re-order. (Each worktree is isolated, so
  nothing else is poisoned.)
- **`/gx-next` or `/gx-go` hits a hard STOP** that can't be auto-recovered (push
  rejected, genuinely operator-owned dirty `.gainwix/<component>/inbox.md`/the backlog (`.gainwix/<component>/backlog.html`),
  GitHub outage): surface the error verbatim and stop the chain. Don't retry
  blindly.

## Report

Print one consolidated summary covering the whole run:

```
/gx-sing complete:

  Planned (ACTION-ITEMS → BACKLOG):
    • <title>            (commit <sha>)
    • …

  Shipped (BACKLOG → done):
    ✓ <title>            PR #<n>  merged @ <sha>   changes/<ts>-change.md
    ✓ …

  Queues:   .gainwix/<component>/inbox.md: <N remaining>   the backlog: <M remaining>
  Next:     <"Both queues empty — done." OR "Stopped: <reason>.">
```

## Notes

- **No `.gainwix/<component>/inbox.md` clearing dance.** An earlier version of the loop
  cleared/recovered a dirty `.gainwix/<component>/inbox.md` because the old `/gx-go` used it as
  scratch. The new `/gx-go` never touches `.gainwix/<component>/inbox.md`; the new `/gx-next`
  consumes from it and commits the result to `develop`. So between iterations the
  tree is clean — no recovery needed.
- **No parallel-safe clusters.** The inverted `/gx-next` plans one raw item at a
  time and `/gx-go` executes one task at a time. The old parallel-cluster dispatch
  (and its `<!-- parallel-safe-cluster -->` markers) is retired.
- **Every shipped task gets its own `changes/<ts>-change.md`** via `/gx-go`, linked
  from `.gainwix/<component>/CHANGELOG.md` — that is the per-task record for the run.
- `/gx-sing` itself asks for no confirmation; the standing autonomy preamble in
  the backlog (`.gainwix/<component>/backlog.html`) authorizes the full branch → test → PR → squash-merge → cleanup
  loop.
- **Formerly `/ang`.** This command was renamed from `/ang` to `/gx-sing`
  (Sequential Interactive Next and Go); the behavior is unchanged.
