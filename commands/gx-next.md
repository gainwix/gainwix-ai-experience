---
description: Take the first raw idea from the inbox, plan it into a detailed executable task, and add it to .gainwix/<component>/backlog.html with its dependencies, priority and size — so the waves recompute around it. One item per invocation, top-down.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-next — plan one .gainwix/<component>/inbox.md entry into a the backlog task

The pipeline (note: this is the **reverse** of the old `/gx-next` — .gainwix/<component>/inbox.md
is now the raw inbox and the backlog is the planned queue):

1. You (or the operator) jot **raw ideas** as `- ` bullets in `.gainwix/<component>/inbox.md`,
   below the `<!-- Add action items below this line -->` marker.
2. **`/gx-next`** takes the **top** raw idea, turns it into a fully-planned,
   executable **task**, and **adds it to the backlog** with the tool:

   ```bash
   GX="node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs"
   $GX add --title "<one-line deliverable>" \
           --detail "<why, goal, steps, done-criteria>" \
           --deps "<serials this cannot start without>" \
           --pri P0|P1|P2  --size S|M|L  [--lane <area>]  [--spec "<where it came from>"]
   ```

   ⭐ **`--deps` is the important one and the easy one to skip.** Sequence comes
   *only* from dependencies — priority decides what to pick first **within** a
   wave, never across waves. An item added with no dependencies claims it can
   start today, so if it cannot, say what it waits on. Look at `$GX show` and
   name the serials.

   ⚠ **Do not choose the serial.** The tool assigns the next one for that
   component, and serials are permanent and never reused.

3. **`/gx-go`** later takes the next item from the one wave that can start, and
   records a change file under `.gainwix/<component>/changes/`.

`/gx-next` processes exactly **one** raw item per invocation, scanning top-down from
the first item below the marker. Run it again to plan the next one. Do not ask
for confirmation — the operator invoked `/gx-next` knowing what it does.

## Step 0 — Pre-flight

- Print `Starting /gx-next`.
- **Get on develop (or a branch tracking origin/develop).** Run
  `git rev-parse --abbrev-ref HEAD`.
  - If on `develop`, continue.
  - If on a different branch AND the main checkout already has `develop`
    checked out (so `git checkout develop` would error with "already used by
    worktree at …"), branch a temp off origin/develop:
    `git fetch origin develop && git checkout -b claude/gx-next-tmp-$(date +%s) origin/develop`.
    Remember this — Step 5 pushes `HEAD:develop`.
  - Otherwise run `git checkout develop`.
- **Sync:** `git fetch origin develop && git pull origin develop`. If the pull
  fails (uncommitted changes, diverged history), STOP and surface the error.
- **Cleanliness check:** `git status --porcelain .gainwix`.
  If either is already dirty, STOP and tell the operator — `/gx-next` would
  otherwise sweep their pre-existing edits into its commit.
- **GitHub auth (best-effort):** run `gh auth status`. It's needed only for the
  kanban `queued`→`WIP` transition in Step 4b when the planned item tracks an
  issue. If the item references **no** issue, `gh` isn't required — don't abort on
  a failed `gh auth`; just note that the `WIP` transition will be skipped.

## Step 1 — Read ONE raw item from .gainwix/<component>/inbox.md

- Read `.gainwix/<component>/inbox.md`. Locate the marker line
  `<!-- Add action items below this line -->`.
- The **raw item** is the **first line starting with `- ` (dash + space)** that
  appears AFTER the marker, scanning top-down. Capture its full body verbatim,
  from that `- ` line through to whichever comes first:
  - (a) a blank line followed by another column-0 `- ` line,
  - (b) a blank line followed by a `#` / `##` / `###` header, or
  - (c) end of file.

  Preserve hanging-indent continuation lines (so a multi-line raw idea is taken
  whole).
- If there is **no** `- ` item below the marker, print
  `No action items to plan — .gainwix/<component>/inbox.md is empty below the marker.` and
  STOP (touch nothing).
- Print `Planning: <first line of the item, truncated to ~80 chars>`. Only this
  one item is processed this invocation.

## Step 2 — Plan it (build the task)

Turn the raw item into a detailed, **executable** task, written as a single
the backlog (`.gainwix/<component>/backlog.html`) item — a `- ` lead line plus an indented body so `/gx-go` captures the
whole thing as one item. Shape:

```
- **<Title>.** <one-line summary of the deliverable>
  - **Why:** <what this delivers + why it matters>
  - **Decisions (assume these):** <concrete assumptions; flag anything that needs
    verification before code lands>
  - **Goal:** <the operator-visible end state>
  - **Steps:** <concrete, numbered — name the files / models / migrations /
    endpoints; 1–3 PRs' worth of work>
  - **Done:** <done-criteria — e.g. the project's test suite green + linter clean (per `.gainwix/autonomy.md`)>
  - **Tracks:** <if the raw item references a GitHub issue, carry it forward as
    **`Tracks #<N>`** + the `[#<N>](<url>)` link. This is the KANBAN issue
    (`queued`→`WIP`→`DONE`) — `/gx-go` opens a SUBORDINATE issue under #<N> and its PR
    closes that SUBORDINATE, NOT #<N>. OMIT this line if the item references no
    issue.>
```

- **All body lines are indented ≥2 spaces** so the item reads as one block and
  `/gx-go`'s body-capture takes the whole task. Pull from your knowledge of the
  codebase and be concrete (controller paths, model names, rake tasks, migration
  shapes).
- If the raw idea clearly decomposes into independent deliverables, append
  **multiple** `- ` tasks, each self-contained.
- **Preserve GitHub issue references (as the kanban issue).** If the raw item
  references an issue (a `#<N>`, a `Tracks #<N>`, or an issue URL — e.g. items
  queued by `/gx-issue-pick` or `/gx-qbugs`), copy that reference into the planned task's
  **Tracks:** line as the **kanban `Tracks #<N>`** (issue **id + the `[#<N>](<url>)`
  link**) — NOT a `Closes #<N>` for the fixing PR. This is the KANBAN issue: it
  flows `queued`→`WIP`→`DONE`, and `/gx-go` opens a SUBORDINATE issue under #<N> whose
  PR `Closes` the SUBORDINATE (never #<N>). The reference keeps the kanban tracked
  end-to-end — `/gx-issue-pick` → `.gainwix/<component>/inbox.md` → `/gx-next` (BACKLOG **Tracks:** +
  `queued`→`WIP`) → `/gx-go` (subordinate of #<N>) → `/gx-qa`/`/gx-qbugs` (`WIP`→`DONE`).
  Never invent an issue reference when the item has none.

## Step 3 — Append the task to the backlog

- Read the backlog (`.gainwix/<component>/backlog.html`). Append the planned task(s) to the **END** of the
  `## Backlog Items` section (after any existing tasks; preserve the
  instructions region and the `### Autonomy preamble` above it untouched).
- Newest tasks go last, so `/gx-go`'s top-down read processes the backlog FIFO.

## Step 4 — Remove the consumed item from .gainwix/<component>/inbox.md

- Delete the exact raw-item body captured in Step 1 from `.gainwix/<component>/inbox.md` (plus
  the single blank line immediately after it, if present), leaving the
  `<!-- Add action items below this line -->` marker and all remaining items
  intact. This advances the queue so the next `/gx-next` reads the next item.
- **Never delete the marker line** or anything above it.

## Step 4b — Move the tracked issue to `WIP` (kanban)

If the planned item **tracks a GitHub issue `#<N>`** (its **Tracks:** line carries
`Tracks #<N>` + the `[#<N>](<url>)` link), transition it on the kanban —
`queued`→`WIP` — best-effort (note it if it fails, don't abort the run):

```bash
gh label create WIP --color fbca04 \
  --description "Work in progress — planned into BACKLOG via /gx-next" 2>/dev/null || true
gh issue edit <N> --remove-label queued --add-label WIP   # queued → WIP (--remove-label is a no-op if absent)
```

This is a **remote GitHub op** (operational, like `/gx-qbugs`'s labeling) — it advances
`#<N>` from "waiting" to "in progress". **Skip it entirely** when the item
references no issue (no `Tracks #<N>` → nothing to transition; `gh` isn't required).

## Step 5 — Commit + push to develop

Per the project convention, the queue mutation lands directly on `develop`.

- Stage **both** `.gainwix/<component>/inbox.md` and the backlog (`.gainwix/<component>/backlog.html`). Commit (heredoc to preserve
  formatting):

  ```
  chore: plan ACTION-ITEMS entry into BACKLOG — <one-line title>

  /gx-next consumed the top .gainwix/<component>/inbox.md raw item, planned it into an
  executable task, and appended that task to the backlog (## Backlog Items).
  The consumed raw item was removed from .gainwix/<component>/inbox.md.

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

- Push to develop: `git push origin develop` — or `git push origin HEAD:develop`
  if Step 0 took the temp-branch path. If the push is rejected (branch
  protection, racing fetch), STOP and surface the error; do not amend or
  force-push.

## Step 6 — Report

Print a short summary:
- `Planned: <title>` and a one-line description of the BACKLOG task appended.
- If the item tracked an issue, note the kanban move: `#<N> queued → WIP` (or that
  the transition was skipped/failed and why).
- How many raw items remain in `.gainwix/<component>/inbox.md` below the marker.
- The commit hash.
- Pointer: `Run /gx-go to execute the top BACKLOG task, or /gx-next again to plan the
  next ACTION-ITEMS entry.`

## Notes

- **One raw item per invocation**, top-down from the first item below the marker.
- **`/gx-next` PLANS only** (no code execution). It never runs tests, opens PRs, or
  writes a `.gainwix/<component>/changes/*.md` record — execution + the change record are `/gx-go`'s job.
  Its only remote action is the best-effort kanban `queued`→`WIP` label transition
  (Step 4b), and only when the item tracks an issue — operational, like `/gx-qbugs`
  labeling, not code execution.
- Never touch the `<!-- Add action items below this line -->` marker or the
  instructions / autonomy-preamble regions of either file.
- **`/gx-sing` note:** `/gx-sing` (formerly `/ang`) chains `/gx-next` + `/gx-go`. With this
  inverted `/gx-next`, the `/gx-sing` flow means "plan the top ACTION-ITEMS entry into
  BACKLOG, then `/gx-go` the top BACKLOG task" — take the next item, work it, come
  back for more.
