---
description: Dequeue the OLDEST `queued` GitHub issues into ACTION-ITEMS.md (FIFO). Lists OPEN issues labeled `queued` oldest-first (optional cap `/gx-issue-pick <N>`), appends one raw ACTION-ITEMS task per issue (carrying the issue id + link for the `queued`→`WIP`→`DONE` kanban), and REMOVES the `queued` label from each (dequeued from the waiting queue into active work). Reads the real-time list API + jq (no search-index lag). OPERATIONAL like /gx-qbugs//gx-qa//gx-sweep: removes the label + commits the ACTION-ITEMS queue edit to develop; NOT a /gx-go change. Idempotent (a dequeued issue loses `queued`, so it's never re-picked). Stops cleanly when the queue is empty.
disable-model-invocation: true
---

# /gx-issue-pick — dequeue the oldest `queued` issues into ACTION-ITEMS.md (FIFO)

`/gx-issue-pick` is the bridge **from the `queued` issue queue into the repo's work
pipeline**. It takes the **oldest** `queued`-labeled open issues (FIFO), lines them
up in `ACTION-ITEMS.md`, and **dequeues** them — removing the `queued` label, since
they've moved from "waiting in the queue" into active work:

> `/gx-issue-add` (enqueue) → `/gx-issue-list` (view the queue) → **`/gx-issue-pick`
> (dequeue → `ACTION-ITEMS.md`)** → `/gx-next` (plan + `queued`→`WIP`) → `BACKLOG.md` →
> `/gx-go` (fix via a **subordinate** issue; PR closes the subordinate, not the kanban
> issue) → `/gx-qa`/`/gx-qbugs` (`WIP`→`DONE`).

## The `queued` label — the waiting queue

`queued` marks an open issue **waiting in the work queue** (filed by `/gx-issue-add`,
or tagged by hand / a future command). `/gx-issue-pick` **dequeues** the oldest ones:

- **Eligible to pick** = an OPEN issue **WITH** the `queued` label (and never a PR).
- `/gx-issue-pick` lines it up in `ACTION-ITEMS.md` (oldest-first), then **removes its
  `queued` label** — it's now in the active pipeline, no longer waiting. A re-run
  skips it (no longer `queued`).
- **The kanban continues from here:** the issue is the tracked kanban card that
  flows `queued` → (`/gx-issue-pick` dequeues, removes `queued`) → `/gx-next` plans it +
  moves it to **`WIP`** → `/gx-go` opens a **subordinate** issue under it (the PR
  closes the subordinate, **not** this issue) → `/gx-qa`/`/gx-qbugs` move it to **`DONE`**
  (label + close) once every subordinate is closed AND the latest `/gx-qa` run is
  green. So `/gx-issue-pick` removes `queued`; `/gx-next` adds `WIP`; `/gx-qa`/`/gx-qbugs` add
  `DONE` + close.
- **To put an issue (back) in the queue**, add the `queued` label (or `/gx-issue-add`
  a new one). `/gx-issue-list` shows the current `queued` queue, oldest-first.

`/gx-issue-pick` only REMOVES the `queued` label + writes `ACTION-ITEMS.md`; it never
closes issues (the kanban issue is closed later by `/gx-qa`/`/gx-qbugs` when it reaches
`DONE`; the `/gx-go` PR closes only the SUBORDINATE issue, not the kanban one) and
never touches `BACKLOG.md` or app source.

## Operational, not a /gx-go change

A `/gx-issue-pick` RUN is **OPERATIONAL, like `/gx-qbugs`/`/gx-qa`/`/gx-sweep`** — it removes
the `queued` label (remote-side) and commits the **`ACTION-ITEMS.md` queue edit**
directly to `develop` (a queue mutation, like `/gx-next`). It does **NOT** run the
`/gx-go` workflow, write a `changes/*.md`, or add a `CHANGELOG.md` entry. (Modifying
the `/gx-issue-pick` machinery — this recipe — IS a normal `/gx-go` change; only
*running* a pick is operational.)

## Invocation

- `/gx-issue-pick` — dequeue ALL currently-`queued` open issues (oldest-first).
- `/gx-issue-pick <N>` — dequeue only the **oldest N**.

## Step 0 — Pre-flight

```bash
git fetch origin develop                 # be on develop (or a develop-tracking worktree) + synced
git status --porcelain ACTION-ITEMS.md   # expect EMPTY; if dirty, STOP — don't mix edits
gh auth status                           # required to list + unlabel issues
gh label create queued --color 1d76db \
  --description "Queued into ACTION-ITEMS.md by /gx-issue-pick" 2>/dev/null || true
```

If `ACTION-ITEMS.md` is dirty, or `gh auth` fails, STOP and report.

## Step 1 — Find the oldest `queued` issues (FIFO)

List OPEN issues that ARE labeled `queued`, **oldest-first** by creation date. Use
the REAL-TIME list API + `jq` for the sort — NOT `--search`, whose SEARCH INDEX
lags a few seconds behind a just-applied/removed label (so a freshly-tagged issue
would be missed, or a freshly-dequeued one re-picked):

```bash
# Real-time list API (reflects label changes immediately). In jq: drop any issue
# also labeled `blocked` (queued but not ready), and sort oldest-first.
gh issue list --state open --label queued --limit 500 \
  --json number,title,createdAt,labels,body,url \
  --jq 'map(select(.labels | map(.name) | any(. == "blocked") | not))
        | sort_by(.createdAt)'
```

- `gh issue list --label queued` is the scope — ONLY `queued` issues (never PRs), in real time.
- The `jq` drops any `queued` issue **also** labeled `blocked` (queued but not ready to work); `sort_by(.createdAt)` orders oldest → newest (FIFO).
- **Secondary dedup:** also skip any issue whose `#<n>` is ALREADY referenced in
  `ACTION-ITEMS.md` (covers a prior partial run where Step 3's label removal didn't
  land): `grep -qE "#<n>\b" ACTION-ITEMS.md`.
- If `/gx-issue-pick <N>` was given, keep only the **oldest N** that remain.

If there are **zero** eligible issues, print **"No `queued` issues to pick — the
queue is empty."** and STOP (no label changes, no commit).

## Step 2 — Append one ACTION-ITEMS task per issue (oldest → newest)

For each picked issue, in **oldest-first order**, append ONE raw `- ` line to
`ACTION-ITEMS.md` **below the `<!-- Add action items below this line -->`
marker**, AFTER any existing items (existing queue keeps its priority; within the
picked batch the oldest issue is first, so it gets worked first). Format:

```
- **[#<N>] <issue title>** — <one-line summary: the issue's first non-empty body line, trimmed; or just the title if the body is empty>. **Tracks GitHub issue [#<N>](<url>)** (kanban: `queued`→`WIP`→`DONE`). `/gx-next` moves it to `WIP`; `/gx-go` opens a **subordinate** issue under it (the PR closes the subordinate, **not** #<N>); `/gx-qa`/`/gx-qbugs` close it to `DONE` once all subordinates are closed + the suite is green. _(opened <YYYY-MM-DD>)_
```

- `<url>` is the issue's `url` from Step 1's JSON (e.g.
  `https://github.com/<owner>/<repo>/issues/<N>`) — use the real value, don't
  hardcode the repo.
- The `[#<N>](<url>)` markdown link (issue **id + clickable URL**) is the **kanban
  issue**, tracked through the pipeline: `/gx-next` carries it into the `BACKLOG.md`
  task (its **Tracks:** line) and moves it `queued`→`WIP`; `/gx-go` then opens a
  **SUBORDINATE** issue under #<N> and its PR `Closes` the SUBORDINATE (**not**
  #<N>, which stays open); `/gx-qa`/`/gx-qbugs` move #<N> to `DONE` (label + close) once
  all its subordinates are closed AND the latest `/gx-qa` run is green.

Append all lines in ONE edit; preserve the marker, the header, and any existing
content. Do **NOT** plan or implement the fix here — that's `/gx-next` → `/gx-go`.

## Step 3 — Dequeue: remove the `queued` label from each picked issue (best-effort)

```bash
for N in <picked issue numbers>; do
  gh issue edit "$N" --remove-label queued || echo "WARN: could not unlabel #$N"
done
```

"Try" to dequeue every picked issue; if a removal fails, note it and continue (the
`ACTION-ITEMS.md` `#N` reference is the backup dedup, so a still-`queued` issue
that's already in `ACTION-ITEMS.md` won't be re-picked next run).

## Step 4 — Commit the queue edit (operational)

```bash
git add ACTION-ITEMS.md
git commit -m "issue-pick: dequeue <N> queued issue(s) into ACTION-ITEMS (oldest-first)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin develop
```

Commit ONLY `ACTION-ITEMS.md`. Skip the commit entirely if nothing was dequeued.

## Step 5 — Report

Print a roll-up:

- **Dequeued (oldest → newest):** each `#N — <title>` (with its opened date) — lined up in `ACTION-ITEMS.md` and un-labeled `queued`.
- **Skipped:** issues excluded + WHY (also `blocked`; or already referenced in `ACTION-ITEMS.md`).
- **Counts + next step:** "`<N>` dequeued; `<M>` still in the `queued` queue (`/gx-issue-list`). Run **`/gx-next`** (plan one + move it `queued`→`WIP`), **`/gx-sing`** (serial), or **`/gx-ping`** (parallel) to work them; each fix is a `/gx-go` PR that closes a **subordinate** issue (not the kanban `#N`, which `/gx-qa`/`/gx-qbugs` close to `DONE` once its subordinates are done + the suite is green)."

## Notes

- **FIFO dequeue.** Picks by ascending `createdAt`, so the oldest `queued` issue is
  taken first; once dequeued it loses the `queued` label and leaves `/gx-issue-list`.
- **`queued` is the waiting queue; the kanban continues past it.** `/gx-issue-pick`
  removes `queued` on pick (issue → active work); `/gx-next` adds `WIP`; the issue is
  the tracked kanban card, and `/gx-go`'s PR closes only the SUBORDINATE it opens
  (never this issue) — `/gx-qa`/`/gx-qbugs` move this issue to `DONE` + close it once its
  subordinates are closed + the suite is green. Re-add the `queued` label to put an
  issue back in the queue.
- **Operational, not `/gx-go`** — removes the label + commits the `ACTION-ITEMS.md`
  queue edit to `develop`; no `changes/*.md` / `CHANGELOG.md`. Building/altering
  this recipe IS a `/gx-go` change.
- **One driver at a time** — like `/gx-next`/`/gx-qbugs`, don't run it concurrently with
  another command mutating `ACTION-ITEMS.md` / the `develop` tip.
- **The `queued` family.** `/gx-issue-add` enqueues (creates + labels `queued`),
  `/gx-issue-list` views the queue oldest-first, and `/gx-issue-pick` dequeues the oldest
  into `ACTION-ITEMS.md`. Pairs with `/gx-qbugs`, which FILES bug Issues from `/gx-qa`
  failures — label those `queued` (e.g. via `/gx-issue-pick`'s sibling tagging or by
  hand) to feed them into the same queue.
```
