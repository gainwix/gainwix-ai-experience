---
description: Sequential Interactive Next and Go — take the next item from the top, work it end-to-end, then come back for more. Each iteration plans the top ACTION-ITEMS.md raw item into BACKLOG.md (/gx-next) then executes the top BACKLOG.md task end-to-end (/gx-go), recording a changes/*.md change file. Strictly serial; auto-loops until ACTION-ITEMS.md (below the marker) and BACKLOG.md (## Backlog Items) are both empty.
disable-model-invocation: true
---

# /gx-sing — sequential interactive /gx-next + /gx-go

`/gx-sing` ("**S**equential **I**nteractive **N**ext and **G**o") chains the
inverted `/gx-next` and the `/gx-go` workflow into one loop: it takes the next item
from the top, works it end-to-end, then comes back for more once it's done. It
runs with **no confirmation prompts between stages**, under the
`### Autonomy preamble (read first)` in `BACKLOG.md` (read by both `/gx-next` and
`/gx-go`) — make reasonable assumptions and proceed end-to-end.

**Pipeline reminder:** `ACTION-ITEMS.md` (raw-idea inbox, below the
`<!-- Add action items below this line -->` marker) → **`/gx-next`** (plan the top
raw item → append a task to `BACKLOG.md`) → **`/gx-go`** (execute the top
`BACKLOG.md` task → ship the PR + record `changes/<ts>-change.md` + link it in
`CHANGELOG.md`). `/gx-sing` drives both, repeatedly, until both queues are empty.

## One iteration

1. **Plan — run `/gx-next`** (`${CLAUDE_PLUGIN_ROOT}/commands/gx-next.md`): if there is a raw `- `
   item below the `<!-- Add action items below this line -->` marker in
   `ACTION-ITEMS.md`, run the full `/gx-next` workflow — plan the **top** raw item,
   append the executable task to `## Backlog Items` in `BACKLOG.md`, remove the
   consumed raw item from `ACTION-ITEMS.md`, and commit + push both files to
   `develop`. If there is **no** raw item below the marker, **skip `/gx-next`** this
   iteration.
2. **Execute — run `/gx-go`** (`${CLAUDE_PLUGIN_ROOT}/commands/gx-go.md`) in **backlog mode**: if
   there is a `- ` task under `## Backlog Items` in `BACKLOG.md`, run the full
   `/gx-go` workflow — execute the **top** task end-to-end (worktree → build →
   test → commit → push → PR → squash-merge), write `changes/<ts>-change.md`
   (with the GitHub PR/issue links, timeline, session info, Tokens-or-Tools,
   elapsed), append a link to `CHANGELOG.md`, and remove the executed task from
   `BACKLOG.md` as part of the task's PR. If there are **no** tasks under
   `## Backlog Items`, **skip `/gx-go`** this iteration.
3. If **both** stages were skipped (nothing to plan AND nothing to execute) →
   both queues are drained: print the final roll-up (below) and STOP.

> One iteration ships at most one PR (from `/gx-go`). `/gx-next` appends to the bottom
> of `BACKLOG.md` and `/gx-go` takes the top, so the two queues drain FIFO over
> successive iterations — it doesn't matter if `BACKLOG.md` already had tasks.

## Auto-loop

After each iteration, re-evaluate and repeat — **no prompts** — until BOTH:

- `ACTION-ITEMS.md` has no `- ` item below the marker, AND
- `BACKLOG.md` has no `- ` item under `## Backlog Items`.

There is no parallel/cluster dispatch and no hard iteration cap. `/gx-sing` is
strictly serial: plan one, execute one, repeat. The expected termination is
"both queues empty." The operator can Ctrl-C at any point; re-invoking `/gx-sing`
resumes draining from the current state (each `/gx-go` task is its own worktree +
PR, so a partial run leaves a consistent repo).

## Failure handling

- **`/gx-go` task fails to merge** (CI red, conflict, etc.): record it in the
  roll-up with the error verbatim, leave that task in `BACKLOG.md`, and — because
  it would just fail again on the next top-read — **STOP** rather than spin.
  Surface it so the operator can fix or re-order. (Each worktree is isolated, so
  nothing else is poisoned.)
- **`/gx-next` or `/gx-go` hits a hard STOP** that can't be auto-recovered (push
  rejected, genuinely operator-owned dirty `ACTION-ITEMS.md`/`BACKLOG.md`,
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

  Queues:   ACTION-ITEMS.md: <N remaining>   BACKLOG.md: <M remaining>
  Next:     <"Both queues empty — done." OR "Stopped: <reason>.">
```

## Notes

- **No `ACTION-ITEMS.md` clearing dance.** An earlier version of the loop
  cleared/recovered a dirty `ACTION-ITEMS.md` because the old `/gx-go` used it as
  scratch. The new `/gx-go` never touches `ACTION-ITEMS.md`; the new `/gx-next`
  consumes from it and commits the result to `develop`. So between iterations the
  tree is clean — no recovery needed.
- **No parallel-safe clusters.** The inverted `/gx-next` plans one raw item at a
  time and `/gx-go` executes one task at a time. The old parallel-cluster dispatch
  (and its `<!-- parallel-safe-cluster -->` markers) is retired.
- **Every shipped task gets its own `changes/<ts>-change.md`** via `/gx-go`, linked
  from `CHANGELOG.md` — that is the per-task record for the run.
- `/gx-sing` itself asks for no confirmation; the standing autonomy preamble in
  `BACKLOG.md` authorizes the full branch → test → PR → squash-merge → cleanup
  loop.
- **Formerly `/ang`.** This command was renamed from `/ang` to `/gx-sing`
  (Sequential Interactive Next and Go); the behavior is unchanged.
