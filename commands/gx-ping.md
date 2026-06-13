---
description: Parallel Interactive Next and Go loop — read ALL of ACTION-ITEMS.md, work out which items are mutually conflict-free, pick up to 5 of them, and build those in parallel (one agent team per item, each in its own git worktree) within the same session. Plan + implement run in parallel; merges are serialized (rebase on develop, re-test, squash-merge). Falls back to serial when nothing is parallel-safe. Loops until ACTION-ITEMS.md (below the marker) and BACKLOG.md (## Backlog Items) are both empty.
disable-model-invocation: true
---

# /gx-ping — parallel interactive /gx-next + /gx-go loop

`/gx-ping` ("**P**arallel **I**nteractive **N**ext and **G**o") is the parallel
sibling of `/gx-sing`. Instead of taking one item at a time, each iteration reads
the **whole** `ACTION-ITEMS.md`, selects a batch of **mutually conflict-free**
items (up to 5), and builds them **in parallel** — one agent team per item, each
in its own git worktree, all within this one session. It runs under the
`### Autonomy preamble (read first)` in `BACKLOG.md` — no confirmation prompts.

**The golden rule:** *implementation is parallel; integration is serial.* Agents
build and test concurrently in isolated worktrees, but the resulting PRs all
target one `develop`, so they are merged **one at a time** (rebase → re-test →
squash-merge). If the batch is chosen well (truly file-disjoint), the rebases are
clean and the serial tail is cheap.

## Pre-flight: is parallelism even available?

Parallelism here is bounded by real constraints — be honest about them every run:

- **File disjointness.** Two items may run in parallel only if they touch
  **disjoint files**. Most of this repo's UI items touch shared files
  (`config/routes.rb`, the layouts, shared Beacon CSS/partials), so the
  genuinely-parallel batch is often **smaller than 5 — sometimes 1**. That's
  expected; when it's 1, `/gx-ping` just does that one item (like `/gx-sing`).
- **At most one migration per batch.** Migrations are sequentially numbered
  (`railsaptonaiapi/db/README.md`): two worktrees adding a migration in parallel
  grab the same number and collide. **No batch may contain more than one
  migration-adding item.**
- **No intra-batch dependencies.** If item B builds on item A (A must ship
  first), they can't be in the same batch.

## One iteration

1. **Read the whole queue.** Read every `- ` item below the
   `<!-- Add action items below this line -->` marker in `ACTION-ITEMS.md`
   (top = highest priority).

2. **Conflict analysis.** For each item, infer (from its description + a quick
   scan of the controllers/views/routes/models it names) the **set of files it
   will create or modify** and whether it **adds a DB migration**. Build a
   conflict graph: items *i* and *j* conflict if they share any file, both add a
   migration, or one depends on the other. Be **conservative** — when unsure
   whether two items overlap, treat them as conflicting (a false "parallel" costs
   a wasted worktree + a dropped merge; a false "serial" only costs a little
   wall-clock).

3. **Select the batch.** Choose a **maximum set of mutually non-conflicting
   items, capped at 5**, preferring higher-priority (top-of-list) items as
   tie-breakers, and containing **≤ 1 migration item**. If only 0–1 items are
   parallel-safe, the batch is just the single top item (degrade to serial).
   `log()` which items were chosen and which were deferred (and why).

4. **Plan the batch (parallel `/gx-next`).** For each selected item run the `/gx-next`
   planning: append its executable task to `## Backlog Items` in `BACKLOG.md` and
   remove the consumed raw item from `ACTION-ITEMS.md`. Commit + push both files
   to `develop` **once** for the whole batch (a single `chore(next)` commit
   listing the batch).

5. **Implement in parallel.** Spin up **one agent team per selected item** —
   prefer the **Workflow tool** with `isolation: 'worktree'` (each agent gets a
   fresh worktree off the latest `origin/develop`); parallel `Agent` calls in a
   single message are an acceptable alternative. Each team runs its item's `/gx-go`
   **implementation** only: branch → implement → `cd railsaptonaiapi && bin/rails test`
   green (+ refresh `COVERAGE.md`, keep ≥ 95%) → `bin/rubocop` → commit (dequeue
   its `BACKLOG.md` task in the commit) → push its branch → open its PR. **Each
   team STOPS before merging** — merging is the serial step below. One PR +
   one `changes/<ts>-change.md` per item, exactly as `/gx-go` produces.

6. **Integrate serially.** Merge the batch's PRs **one at a time**: for each,
   rebase its branch on the latest `origin/develop`, re-run the affected tests,
   then `gh pr merge --squash --delete-branch`. After each merge, the next
   rebase picks up the new tip. If a rebase/merge **conflicts** (the static
   analysis missed an overlap) or its re-test fails: **do not force it** — leave
   that item's task in `BACKLOG.md` (or return it to `ACTION-ITEMS.md`), close or
   park its PR, and record it in the roll-up. It gets retried (likely serially)
   on a later iteration. Finalize each merged item's `changes/<ts>-change.md`
   (issue/PR links, timing) and its `CHANGELOG.md` link, and remove its worktree.

7. **Loop.** Re-evaluate from step 1 with a fresh batch — **no prompts** — until
   BOTH `ACTION-ITEMS.md` (below the marker) and `BACKLOG.md` (`## Backlog
   Items`) have no `- ` items left.

## Hard safety rules

- **Never** put two items that touch the same file in one batch.
- **Never** put two migration-adding items in one batch (≤ 1 migration per batch).
- **Never** merge in parallel — always rebase-on-latest-`develop` + re-test +
  squash-merge, one PR at a time.
- **Never** force a conflicting merge — drop the item back to the queue and
  surface it.
- Each item is still its own branch, its own PR, and its own
  `changes/<ts>-change.md` (parallelism changes *how many run at once*, not the
  one-PR-per-change contract).

## Failure handling

- **An implementation team fails** (tests won't go green, build broken): that
  item ships no PR; leave its task in `BACKLOG.md`, record the error verbatim in
  the roll-up, and continue integrating the teams that did succeed.
- **A merge conflicts or re-test fails at integration:** park that item (back to
  `BACKLOG.md`/`ACTION-ITEMS.md`), continue with the rest of the batch, and let a
  later iteration retry it serially.
- **A whole iteration makes no progress** (batch selected but every team failed
  or every merge was dropped): **STOP** rather than spin, and surface why.
- **Hard STOP** (push rejected, GitHub outage, operator-owned dirty queue files):
  surface the error verbatim and stop the chain.

## Report

Print one consolidated summary covering the whole run:

```
/gx-ping complete:

  Batches:
    Batch 1 (parallel ×N):
      ✓ <title>          PR #<n>  merged @ <sha>   changes/<ts>-change.md
      ✓ <title>          PR #<n>  merged @ <sha>   changes/<ts>-change.md
      ⤺ <title>          deferred (file overlap with <other> — retried serially)
    Batch 2 (parallel ×M):
      ✓ …

  Deferred / failed:
    • <title> — <reason verbatim>

  Queues:   ACTION-ITEMS.md: <N remaining>   BACKLOG.md: <M remaining>
  Next:     <"Both queues empty — done." OR "Stopped: <reason>.">
```

## Notes

- **`/gx-ping` vs `/gx-sing`.** `/gx-sing` is strictly serial (one item, fully, then the
  next). `/gx-ping` parallelizes the *implementation* of a conflict-free batch but
  keeps *integration* serial. For a tightly-coupled queue they converge — `/gx-ping`
  with a batch of 1 **is** `/gx-sing` for that iteration. Use `/gx-ping` when the queue
  has genuinely independent work in separate areas; use `/gx-sing` when it doesn't
  (or to avoid the extra token cost).
- **Same session.** The parallel teams run inside this one session (Workflow
  subagents / parallel `Agent` calls), each isolated in its own git worktree —
  not separate Claude Code sessions.
- **Cost.** Running N teams at once burns roughly N× the tokens of one `/gx-go`.
  Keep the batch to genuinely-independent items; don't pad it to reach 5.
- **One driver at a time.** Like `/gx-sing`, don't run a second `/gx-ping`/`/gx-sing`
  against the same `develop` concurrently — they'd race the shared queue files
  and `develop` tip.
- Every shipped item gets its own `changes/<ts>-change.md` via its team's `/gx-go`
  implementation, linked from `CHANGELOG.md`. `/gx-ping` itself asks for no
  confirmation; the standing autonomy preamble in `BACKLOG.md` authorizes the
  full loop.
