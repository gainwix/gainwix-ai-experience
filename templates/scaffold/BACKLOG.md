# Backlog

----------------------------------------------------------------

## Prioritized Backlog for use by Claude Code

- Anything added under **`## Backlog Items`** (at the bottom) can be read and
  modified by Claude.
- `/gx-next` pulls the **top** raw item from `ACTION-ITEMS.md`, plans it into a
  detailed executable task, and **appends it under `## Backlog Items`** here.
- `/gx-go` executes the **top** `## Backlog Items` task end-to-end (branch →
  test → PR → squash-merge) and records a `changes/*.md` entry linked from
  `CHANGELOG.md`.
- `/gx-sing` (serial) and `/gx-ping` (parallel) drive `/gx-next` + `/gx-go` in a
  loop until both queues are empty.
- Add a single task with a leading hyphen (a `- ` lead line plus an indented
  body so `/gx-go` captures the whole thing as one item).
- Add multiple tasks as multiple bulleted items under an H3 (`### `) heading.
- See below for the shape:

- **<Title>.** <one-line deliverable>
  - **Why:** <what this delivers + why it matters>
  - **Goal:** <the operator-visible end state>
  - **Steps:** <concrete, numbered — name the files / endpoints; 1–3 PRs' worth>
  - **Done:** <done-criteria — e.g. test suite green + linter clean>

### Autonomy preamble (read first)

Execute the queued tasks without asking for any approval and make reasonable
assumptions. By invoking `/gx-go` / `/gx-sing` / `/gx-ping`, the operator has
given explicit pre-approval to run this entire workflow end-to-end without any
further prompting. That includes:

- Branching from `origin/develop` (this workflow's integration trunk — **create a
  `develop` branch if your repo doesn't have one**; the workflow standardizes on
  `develop` and does not support a different trunk name) — no need to ask before
  branching, generating files, or running the standard build loop.
- Running the project's build/setup steps (dependency installs, database
  migrations, code generation) autonomously.
- Running the test suite, fixing failures, and re-running until green.
- Restarting any dev server whose code a change touched.
- Opening a GitHub issue, opening the PR, squash-merging it after CI is green,
  and cleaning up local + remote branches.

> Tune this preamble to your repo: set the exact build/test/lint commands for your
> stack (e.g. `npm test`, `pytest`, `go test ./...`, `bin/rails test`, `make check`).
> The trunk is `develop` — create one (`git branch develop`) if your repo lacks it.

----------------------------------------------------------------

## Backlog Items
