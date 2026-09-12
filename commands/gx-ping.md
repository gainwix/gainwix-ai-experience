---
description: Parallel driver — take the ONE wave that can start now, build its items at the same time, merge them one at a time, then stop. The next wave waits for this one to have merged.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`.

# /gx-ping — one wave, built in parallel

`/gx-ping` ("**P**arallel **I**nteractive **N**ext and **G**o") is the parallel
sibling of `/gx-sing`. **Both run exactly one wave and then stop.** The
difference is that `/gx-ping` builds the wave's items at the same time and merges
them serially afterwards, in the driver.

## ⛔ The contract — one wave per execution

> *"run only one wave per execution but that one wave will kickoff parallel
> execution paths"*

**A wave is a set of items that do not depend on each other.** That is what makes
it a wave, and it is exactly why they can all be built at once. **The wave behind
it depends on this one having MERGED.**

So running on into the next wave means building on a foundation that is still
being written — unreviewed, unmerged, and free to change underneath the work.
⛔ **Being picked up is not being done.**

⛔ **`/gx-ping` therefore does not loop.** It takes the wave `$GX ready` hands it,
finishes that wave, and **stops — even when the queue is nowhere near empty.**
Run it again for the next one; the report says which that is and how big.

⚠ **This replaced a loop that ran until both queues were empty.** If you came
looking for that behaviour, it was wrong, and the paragraph above is why.

## Pre-flight: is parallelism even available?

Parallelism is bounded by real constraints — be honest about them every run:

- **File disjointness.** Two items may be built at the same time only if they
  touch **disjoint files**. A wave guarantees they do not depend on each other;
  it guarantees nothing about which files they open. **A wave of six can easily
  be six items that all edit the router.**
- **At most one schema/migration change at a time.** If the project numbers
  migrations sequentially (or versions a single schema file), two worktrees
  adding one concurrently can grab the same number and collide.
- **Cost.** N teams at once burns roughly N× the tokens of one `/gx-go`.

⭐ **None of these shrink the wave** — they only decide how many of its items run
simultaneously. Everything in the wave still ships in this execution.

## The execution

There is one. It is not called an iteration, because nothing repeats.

### 0 · Bind the component, and check nothing is stranded

```bash
GX="node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs"
$GX components
```

⛔ **Do this before anything else.** One component and it is chosen for you; more
than one and `$GX` **exits non-zero** and names them — ask which, then
`$GX use --component <name>`. Every later `$GX` call and `/gx-next` resolve the
component independently, so an unbound choice means planning into one component
and building from another.

```bash
$GX show --stage in-progress
```

⚠ **Anything already in `in-progress` is a stranded item from a crashed run** — a
second driver against the same trunk is forbidden, so there is no other
explanation. It blocks everything behind it and **nothing else will say so.**
Surface it, or return it with `$GX move --id <SERIAL> --to backlog`. Do not start
on top of it silently.

### 1 · Plan — top up the backlog from the inbox

For each raw `- ` item below the `<!-- Add action items below this line -->`
marker in `.gainwix/<component>/inbox.md`, top-down and **up to 5 this run**, run
the `/gx-next` planning: append its task to the backlog and remove the consumed
raw item. Commit + push **once** for the group (a single `chore(next)` commit
listing them).

⭐ **Planning ships no code**, which is why it is not bounded by the wave — but a
newly planned item with no dependencies lands in **wave 0** and is built in this
same run, because the wave is read after this step, never before.

### 2 · ⭐ Read the wave — once, here, after planning

```bash
$GX ready
```

```json
{ "wave": 2, "count": 3, "items": [ … ], "next": { "wave": 3, "count": 5 } }
```

**Hold `items` for the whole run.** Once its items move to `in-progress` they
count as *taken*, so a second `$GX ready` mid-run returns nothing — **the wave is
not re-derivable after you have started it.** `next` is the wave standing behind
this one; say both out loud now, so the size of the run is known before it
starts.

If `count` is `0`: say what is in progress and what it is holding up, and
**STOP** — nothing can legally start.

### 3 · Shape the parallelism — inside the wave only

For each item in the wave, infer (from its description plus a quick scan of the
files it names) the set of files it will create or modify, and whether it adds a
migration. Put items that share a file — or that both add a migration — in
**different groups**. Cap each group at **5**. Be conservative: when unsure
whether two overlap, treat them as overlapping.

⛔ **A conflict delays an item to a later group in this run. It never defers it
to a later run, and it never pulls an item forward from the next wave.** Log the
grouping and why.

### 4 · Build each group in parallel

Mark every item taken as its team starts:

```bash
$GX move --id <SERIAL> --to in-progress [--issue <issue-url>]
```

⚠ **`--issue` is optional and usually absent** — `/gx-go` does not open an issue
until after its tests are green, so unless the item already tracks one there is
no URL yet.

Then spin up **one agent team per item**: prefer the **Workflow tool** with
`isolation: 'worktree'`; parallel `Agent` calls in a single message are an
acceptable alternative. Each team runs its item's `/gx-go` **implementation**
only — branch → implement → the project's test and lint commands green (per
`.gainwix/autonomy.md`) → commit → push → open its PR — and **STOPS before
merging.**

⛔ **Each team must return, in its result: the branch name, the PR URL, and the
path of its `changes/<ts>-change.md`.** The driver merges and cannot go looking
inside a finished subagent's worktree for them. A team that reports success
without these has not finished.

⛔ **The teams make no `$GX move` at all.** Every move is the driver's — pick-up,
completion and put-back alike.

### 5 · Integrate serially

Merge the wave's PRs **one at a time**: rebase on the latest `origin/develop`,
re-run the affected tests, then `gh pr merge --squash --delete-branch`. After
each merge:

```bash
$GX move --id <SERIAL> --to completed --pr-link <pr-url>
```

⭐ **That move is what unblocks the next wave** — nothing else does. Finalize the
item's `changes/<ts>-change.md` (issue/PR links, timing), link it in
`.gainwix/<component>/CHANGELOG.md`, and remove its worktree.

### 6 · STOP, and say what is next

Run `$GX ready` once more *after* all the moves — that is the honest answer, and
it accounts for anything that came back. Print the report and end the run.

⛔ **Start nothing else.** Not the next wave, **and not an item from this wave
that came back after failing** — that one sits in the closing `$GX ready` at the
same wave number, looking perfectly startable. It is not. It failed minutes ago
and nobody has looked at why. Retrying it is the next run's job.

## Hard safety rules

- ⛔ **Never start an item from the next wave**, however idle the machine looks.
- **Never** build two items that touch the same file at the same time.
- **Never** put two migration-adding items in one group (≤ 1 migration per group).
- **Never** merge in parallel — rebase-on-latest-`develop` + re-test +
  squash-merge, one PR at a time.
- **Never** force a conflicting merge — return the item to the backlog and
  surface it.
- Each item is still its own branch, its own PR, and its own
  `changes/<ts>-change.md` (parallelism changes *how many run at once*, not the
  one-PR-per-change contract).

## Failure handling

**Two different failures, with different debris. Do not run one procedure for
both.**

- **A team never went green** — nothing pushed, no PR. ⭐ **Save its change record
  before removing the worktree**: `/gx-go` appends to `changes/<ts>-change.md` as
  it goes, and that partial file is the only account of what failed. Copy it out
  and commit it to `develop`, *then* remove the worktree.
- **A merge conflicts, or the rebased re-test fails** — a branch and a PR exist:
  close or clearly park the PR and delete the pushed branch. Let the next run
  retry it, likely serially via `/gx-sing`.

Both then: `$GX move --id <SERIAL> --to backlog`, record the error **verbatim**
plus which failure it was, and **carry on with the rest of the wave.**

⚠ **The rule on `$GX` exit codes, because it is load-bearing:** a non-zero `$GX`
is a Hard STOP — **except `"already in <stage>"`, which is benign and must be
ignored.** That one only happens when two parties made the same move, which the
driver-owns-every-move rule is there to prevent.

- **The whole wave fails — NOT ONE item merged:** stop and surface why, **and say
  so in the `Next:` line.** ⛔ Do not move on to the next wave to salvage the run.
  ⭐ It is the count of merges that decides this, not the size of the wave.
- **Hard STOP** (push rejected, GitHub outage, operator-owned dirty queue files):
  surface the error verbatim and stop.

### ⛔ The one that wedges the queue

A P0 item that fails **stays at the front of its wave**. `$GX ready` will not
spill past it, so **every later run picks it, fails the same way, and merges
nothing** — and everything behind it never starts.

⚠ **Nothing in the tool prevents this**: no attempt counter, no backoff, no note
on the item. **Say it in the report, in these terms** — "this item has now failed
and is blocking N others" — rather than letting a repeated one-line failure look
like bad luck. It needs a person.

## Report

```
/gx-ping — wave <N>:

  Planned (inbox → backlog):
    • <title>                 <SERIAL>

  Wave <N> — <K> item(s) in <G> group(s):
    ✓ <SERIAL>  <title>       PR #<n>  merged @ <sha>   changes/<ts>-change.md
    ✗ <SERIAL>  <title>       never went green | would not merge
                              <reason verbatim>
                              returned to the backlog; blocking <M> item(s)

  Grouping:  [<SERIAL> <SERIAL>] then [<SERIAL>] — <why they were split>

  Next:  <see the table — one line, plus the "and behind it" line if both apply>
```

**Choosing the `Next:` line — check these in order and take the first that fits:**

| Condition | Print |
|---|---|
| **Nothing merged this run** | `wave <N> failed entirely — nothing merged. Fix <SERIAL> before running again.` |
| Closing `$GX ready` gives the **same** wave number | `wave <N> is unfinished — <K> item(s) came back. Run /gx-ping again to retry.` |
| Closing `$GX ready` gives a **higher** number | `wave <N+1> — <M> item(s) ready. Run /gx-ping again.` |
| `count` is `0`, something is in progress | `Nothing can start: <SERIALs> in progress, holding <SERIALs>.` |
| `count` is `0`, nothing in progress | `The queue is empty.` |

⭐ **When items came back AND a later wave is otherwise clear, print both** — the
retry line, then `and behind it: wave <N+1> — <M> item(s), once <SERIAL> lands.`
The closing call's `next` field is where that second number comes from.

⭐ **"Stopped at the wave boundary", "the whole wave failed" and "finished the
queue" must never print the same line.** Three different states, three different
things for the operator to do.

## Notes

- **`/gx-ping` vs `/gx-sing`.** Same scope — one wave, and both plan up to 5
  inbox items first. Two real differences: `/gx-ping` builds the items together
  and **the driver** merges them serially afterwards; `/gx-sing` works them one at
  a time and lets `/gx-go` merge each itself. For a wave of one they do the same
  work. Use `/gx-sing` when the wave's items all touch the same files anyway, or
  to avoid the token cost.
- **Same session.** The parallel teams run inside this one session (Workflow
  subagents / parallel `Agent` calls), each isolated in its own git worktree —
  not separate Claude Code sessions.
- **One driver at a time.** Don't run a second `/gx-ping`/`/gx-sing` against the
  same `develop` concurrently — they would race the queue files and the tip.
- ⚠ **An item that ships more than one PR has no home in the report or in
  `$GX move --to completed`,** which takes a single `--pr-link`. `/gx-go` permits
  it; this does not represent it. Say so in the report if it happens.
- `/gx-ping` itself asks for no confirmation; `.gainwix/autonomy.md` authorizes
  the branch → test → PR → squash-merge → cleanup loop **for one wave.**
