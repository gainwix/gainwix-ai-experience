---
description: List the `queued`-labeled GitHub issues, oldest-first (FIFO by createdAt). Read-only — shows ONLY issues carrying the `queued` label (the category /gx-issue-pick + /gx-issue-add use), never all of GitHub. Defaults to OPEN issues; `/gx-issue-list all` includes closed; `/gx-issue-list <N>` caps to the oldest N. Makes no changes (no labels, no files, no commit). Operational/read-only; only BUILDING this recipe is a /gx-go change.
disable-model-invocation: true
---

# /gx-issue-list — list the `queued` issues, oldest-first

`/gx-issue-list` shows the **`queued`** set — the issues `/gx-issue-add` files (or you
tag `queued` by hand) — in **oldest-first (FIFO by `createdAt`)** order, so you see
the front of the queue (what `/gx-issue-pick` would **dequeue** next) at the top. It is
**read-only**: it lists, it never labels, edits, or commits anything.

**Scoped to the `queued` label.** It lists ONLY issues carrying `queued` — never
all of GitHub. (That's the difference from a plain `gh issue list`.)

## Invocation

- `/gx-issue-list` — list all **open** `queued` issues, oldest-first.
- `/gx-issue-list <N>` — only the **oldest N** open `queued` issues.
- `/gx-issue-list all` — include **closed** `queued` issues too (full history of the
  set), still oldest-first.

## Step 0 — Pre-flight

```bash
gh auth status                           # required to query issues
```

If `gh auth` fails, STOP and report.

## Step 1 — Query the `queued` set, oldest-first

```bash
# Use the REAL-TIME list API (it reflects label changes immediately) and sort
# oldest-first CLIENT-SIDE with jq. Do NOT order via `--search "sort:created-asc"`:
# that routes through GitHub's SEARCH INDEX, which lags a few seconds behind a
# just-applied/removed `queued` label — so a freshly-tagged issue would be missing
# (or a freshly-untagged one still shown) right after the change.
gh issue list --state open --label queued --limit 500 \
  --json number,title,createdAt,state,url \
  --jq 'sort_by(.createdAt)'
```

- `--label queued` is the scope — it returns ONLY `queued`-tagged issues (never PRs), in real time.
- `jq sort_by(.createdAt)` orders oldest → newest (FIFO) without the search index's lag.
- For `/gx-issue-list <N>`, keep the **oldest N** rows after the sort.
- For `/gx-issue-list all`, swap `--state open` → `--state all` (open + closed).

## Step 2 — Present it (oldest at the top)

Render a compact, oldest-first list — each row: position, `#N`, title, opened date
(+ relative age), state (only when `all` is used), and the URL. For example:

```
queued issues (oldest-first) — <count> open:
  1. #657  [bug] QA-infra: flaky authoring-E2E tail            opened 2026-06-08 (today)   https://github.com/<owner>/<repo>/issues/657
  2. #690  Paginate the admin org list at 50 rows             opened 2026-06-09           https://github.com/.../issues/690
  …
```

If there are **no** `queued` issues, print **"No `queued` issues."** and stop.

## Step 3 — (optional) next step

If there are open `queued` issues, you MAY note: run **`/gx-issue-pick`** to line them
up in `ACTION-ITEMS.md` (oldest-first) for `/gx-next` / `/gx-go`. `/gx-issue-list` itself
changes nothing.

## Notes

- **Read-only.** No labels applied, no files written, no commit, no `/gx-go`.
  Building/altering this recipe IS a `/gx-go` change.
- **Oldest-first (FIFO).** Top of the list = front of the queue = what
  `/gx-issue-pick` would take next.
- **The `queued` family.** `/gx-issue-add` **enqueues** into the set, `/gx-issue-pick`
  **dequeues** the oldest `queued` issues into `ACTION-ITEMS.md` (removing the
  label), and `/gx-issue-list` is the read-only view of the waiting queue.
