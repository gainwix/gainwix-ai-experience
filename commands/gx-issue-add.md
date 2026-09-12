---
description: Create a GitHub issue from a prompt and tag it `queued`. Touches GitHub only — nothing under .gainwix/ and nothing in the repo.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-issue-add — file a GitHub issue from a prompt into the `queued` set

`/gx-issue-add <prompt>` turns a one-line idea into a well-formed GitHub Issue and
tags it with the **`queued`** label — the same category `/gx-issue-pick` and
`/gx-issue-list` operate on. It is the quick "capture an issue" front door to the
issue workflow:

> `/gx-issue-add` (file) → `/gx-issue-list` (review the queue, oldest-first) →
> `/gx-issue-pick` (line up in `.gainwix/<component>/inbox.md`) → `/gx-next` (plan + `queued`→`WIP`) →
> `/gx-go` (fix via a subordinate issue) → `/gx-qa`/`/gx-qbugs` (`WIP`→`DONE`).

**Scoped to the `queued` label.** Every issue it creates gets the `queued` label
(and only that label). It does **not** edit other issues, does **not** scan/list
all of GitHub, and does **not** touch the inbox and the backlog or any repo
file — it just creates **one** GitHub Issue (remote-only). A run is **operational**
(one `gh issue create`); only **building/altering this recipe** is a `/gx-go` change.

## Invocation

- `/gx-issue-add <free-text describing the issue>`
  e.g. `/gx-issue-add the admin org list should paginate at 50 rows — it currently loads every org at once`.

## Step 0 — Pre-flight

```bash
gh auth status                           # required to create + label issues
gh label create queued --color 1d76db \
  --description "Queued into .gainwix/<component>/inbox.md by /gx-issue-pick" 2>/dev/null || true
```

If the prompt is **empty**, STOP and ask for the issue text. If `gh auth` fails,
STOP and report (can't reach GitHub).

## Step 1 — Turn the prompt into a well-formed issue

From the user's prompt, compose:

- **Title** — a concise, specific, imperative summary (≤ ~70 chars). Distill a
  long prompt; don't echo it verbatim.
- **Body** — a clear issue description: a 1–2 sentence **summary / context**;
  **expected vs actual** (for a bug) or the **goal** (for a feature/chore); and a
  short **done-when / acceptance** if it's inferable. Stay **faithful to the
  prompt** — do NOT invent requirements; where the prompt is thin, keep the body
  short rather than fabricating detail. End with a trailing line: `_Filed via /gx-issue-add._`

## Step 2 — Create the issue, tagged `queued`

```bash
BODY_FILE="$(mktemp)"
cat > "$BODY_FILE" <<'EOF'
<composed body>
EOF
gh issue create --label queued --title "<composed title>" --body-file "$BODY_FILE"
rm -f "$BODY_FILE"
```

Use `--body-file` (issue bodies often contain quotes/backticks). Apply **only** the
`queued` label — not `bug`/`enhancement`/etc. (the user can add those by hand).

## Step 3 — Report

Print: the new issue `#N` + URL, its title, and that it was tagged `queued`. Then
the next step: **`/gx-issue-list`** to see the queue oldest-first, or **`/gx-issue-pick`**
to line queued issues up in `.gainwix/<component>/inbox.md` for `/gx-next` / `/gx-go`.

## Notes

- **Only the `queued` label.** `/gx-issue-add` files into the managed `queued` set; it
  doesn't categorize with other labels.
- **Remote-only + operational.** One `gh issue create`; no local file change, no
  commit, no `/gx-go` workflow. Building/altering this recipe IS a `/gx-go` change.
- **The `queued` family.** `/gx-issue-add` **enqueues** (creates the issue + labels it
  `queued`), `/gx-issue-list` **views** the queue oldest-first, and `/gx-issue-pick`
  **dequeues** the oldest `queued` issues into `.gainwix/<component>/inbox.md` (removing the
  label). So an `/gx-issue-add`-filed issue flows straight onto the kanban:
  `/gx-issue-add` → `/gx-issue-list` → `/gx-issue-pick` → `/gx-next` (`queued`→`WIP`) → `/gx-go`
  (subordinate issue) → `/gx-qa`/`/gx-qbugs` (`WIP`→`DONE`).
