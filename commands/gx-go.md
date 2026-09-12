---
description: Run a code-changing task end-to-end — branch, build, test, PR, squash-merge — and record it as a timestamped Markdown change file under .gainwix/<component>/changes/ that renders on GitHub. Takes the next item from the one wave that can start, moves it to in-progress on pick-up and to completed on merge. Mandatory for ALL code changes.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-go — run a task under the autonomy preamble and record it as a Markdown change file

`/gx-go` runs a code-changing task end-to-end (branch → build → test → commit →
push → issue → PR → squash-merge → cleanup) and writes a **Markdown change
record** under `changes/`. Markdown is used (not HTML) so the record **renders
inline on GitHub**. The change file is the single source of truth for "what this
run did" — `/gx-go` **never reads, writes, or clears `.gainwix/<component>/inbox.md`** (that file
is retired from this workflow).

**This workflow is mandatory for every code change in this repo** — whether you
arrived via `/gx-go`, via `/gx-sing`, or via a plain interactive prompt with no slash
command at all. Any and all code changes follow these steps; there is no
shortcut path that skips them (see CLAUDE.md).

**Exception — queuing work is NOT a code change.** If an interactive prompt
simply asks to **add to the backlog / queue** — appending a raw idea to
`.gainwix/<component>/inbox.md` (below the `<!-- Add action items below this line -->` marker)
or a task to the backlog (`.gainwix/<component>/backlog.html`) — that is a lightweight queue edit, not a code change.
Just edit the queue file directly (commit + push it to `develop` like a queue
mutation if appropriate). Do **NOT** spin up this `/gx-go` workflow for it: no
worktree/PR ceremony, **no `.gainwix/<component>/changes/*.md` record, and no `.gainwix/<component>/.gainwix/<component>/CHANGELOG.md` entry**.
The change record documents *executed* work, never merely *queued* work.
(`/gx-next` is the command that turns a queued `.gainwix/<component>/inbox.md` idea into a
the backlog (`.gainwix/<component>/backlog.html`) task; it likewise produces no change record.)

## Step 0 — Read the autonomy preamble, then pick the task

**0a. Read the autonomy preamble (ALWAYS — both modes).** Read
`.gainwix/autonomy.md`. Treat it as **binding** for this run: proceed without
asking for approval, make reasonable assumptions, and run the full branch →
generate → test → fix → commit → push → issue → PR → squash-merge → cleanup loop
autonomously. Do this before anything else.

**0b. Resolve the component.**

```bash
GX="node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs"
$GX components
```

One component and it is chosen for you. More than one and `$GX` refuses and names
them — ask which, then `$GX use --component <name>`. ⛔ **Never guess between
components:** a task written into the wrong backlog is silent and expensive to
unpick.

**0c. Determine the task + the mode:**

- **Backlog mode** — `/gx-go` with no inline task. Ask the tool what can start:

  ```bash
  $GX ready
  ```

  ⭐ **It returns ONE wave**: every item whose dependencies have **merged**, and
  nothing from the next wave. Take the **first** — they are already ordered by
  priority, then serial. If `count` is `0`, say *"nothing can start right now"*,
  name what is in progress and what it is waiting on, and **STOP** — do not
  create a change file.

  Then mark it picked up, before any code changes:

  ```bash
  $GX move --id <SERIAL> --to in-progress --issue <issue-url>
  ```

  ⛔ **That is the dequeue, and it happens now rather than at merge time.** An
  item in `in-progress.html` is *already taken*, so a parallel session will not
  pick up the same work — but it **unblocks nothing**. Only merging does that.

  When the PR squash-merges, close the loop:

  ```bash
  $GX move --id <SERIAL> --to completed --pr-link <pr-url>
  ```

  ⚠ **If the run fails or is abandoned, put it back:** `$GX move --id <SERIAL>
  --to backlog`. An item stranded in `in-progress.html` blocks everything behind
  it and nothing will say so.

- **Interactive mode** — a plain conversational prompt requesting a code change,
  OR `/gx-go <task>` with an inline task. The task is that prompt. **Do not read
  the backlog and do not move anything** (you still read `.gainwix/autonomy.md`
  in 0a). Everything else — the change record and the build/PR loop — is
  identical.

⛔ **Never hand-edit any file under `.gainwix/`.** The tool recomputes the whole
dependency order on every write, so an edit made by hand is either overwritten or
kept beside an order that no longer matches it.
→ `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md`

## Step 1 — Open the change file

Capture timing + identity up front (shell, so it's real wall-clock):

```bash
RECORDS=".gainwix/${COMPONENT}/changes"
mkdir -p "$RECORDS"
TS=$(date '+%Y-%m-%d-%H-%M-%S')          # filename stamp
START_HUMAN=$(date '+%Y-%m-%d %H:%M:%S %Z')
START_EPOCH=$(date +%s)
CHANGE_FILE="${RECORDS}/${TS}-change.md"
```

⚠ **Records are per component** — `.gainwix/<component>/changes/`, indexed by
`.gainwix/<component>/.gainwix/<component>/CHANGELOG.md`. A repo that builds four things keeps four
histories, not one mixed pile.

Create `changes/<TS>-change.md` from the **skeleton in Step 5** with the
top-of-file fields filled in:

- **Client info** (best-effort — never fabricate): the client + entrypoint
  (`$CLAUDE_CODE_ENTRYPOINT`) and the client version (from `$BAGGAGE`'s
  `sentry-release`, e.g. `Claude@…`, if present). If a field is genuinely
  unavailable, write `n/a` rather than guessing.
- **Model(s) used**: the model you are running as for this task, plus any
  distinct subagent models you dispatch. Record the model name(s).
- **Tokens / Tools**: if you can determine **exact** token usage, label the row
  **Tokens** and record the counts (input / output / total). **If you cannot
  determine exact token usage** (the usual case at runtime — do NOT invent
  numbers), instead label the row **Tools** and list **every tool you used**
  during the run — built-in tools (e.g. `Bash`, `Read`, `Edit`, `Write`,
  `Agent`, `AskUserQuestion`, `ToolSearch`, web tools) AND every MCP tool/server
  invoked (e.g. `mcp__ccd_session__*`, `mcp__computer-use__*`). List each tool
  once, by name.
- **Started**: `START_HUMAN`. **Ended** / **Elapsed**: leave as `…` for now;
  fill them in Step 4.
- **Task**: the verbatim task body from Step 0.

The file is written as you go — re-write/patch it at each milestone below.

## Step 2 — Execute the task

Run the project's standard one-PR-per-change workflow (one git worktree per
session — see CLAUDE.md; never edit the shared main checkout). Typically:

1. From a fresh branch off `origin/develop`, implement the task.
2. Run the project's test suite where appropriate (the exact command is declared
   in `.gainwix/autonomy.md` — e.g. `npm test`, `bin/rails test`,
   `pytest`, `go test ./...`, `make check`), only when the change touches code the
   suite covers. If your project regenerates a coverage report as part of the test
   run, **stage and commit it as part of this task's PR** so the committed report
   stays current (never leave it as a stray uncommitted file), and hold coverage at
   or above the project's threshold — if your change drops it below, add tests
   before shipping.
3. Commit with a descriptive message ending in the standard `Co-Authored-By`
   footer (include any refreshed coverage report when the suite ran).
4. Push the branch.
5. Open a GH issue describing the change (best-effort — if blocked, note it in
   the timeline and continue). **`/gx-go` ALWAYS opens its OWN new issue for the
   change** — even when the task tracks a kanban issue (below), do NOT reuse the
   tracked issue as the change's issue.
6. Open a PR against `develop` (reference the **new** issue from step 5 with
   `Closes #<new>` when one was created).
7. Squash-merge the PR (`--squash --delete-branch`) once green.

A task may produce **more than one PR** — record every issue and PR.

### Tracked kanban issue (`Tracks #<N>`) — open a SUBORDINATE, never close `#<N>`

When the BACKLOG task being executed **references a tracked kanban issue `#<N>`**
— its body carries a `Tracks #<N>` line / a `[#<N>](<url>)` link (carried in by
`/gx-issue-pick` → `/gx-next`) — `#<N>` is a kanban card (`queued`→`WIP`→`DONE`), NOT the
change's own issue. Handle it as follows (this MODIFIES steps 5–6 above; for tasks
with **no** tracked issue, steps 5–7 behave EXACTLY as before — open a new issue,
PR `Closes #<new>`):

- **Step 5 still opens `/gx-go`'s OWN new issue** describing the change (unchanged) —
  do NOT reuse `#<N>`.
- **Make that new issue a SUBORDINATE of `#<N>`:**
  - include a `Part of #<N>` line in the new issue's body;
  - add the new issue to `#<N>`'s sub-issue task-list — read `#<N>`'s body, append a
    `- [ ] #<new>` line under a `## Sub-issues (opened by /gx-go)` heading (create the
    heading if absent), then write it back:
    ```bash
    gh issue view <N> --json body -q .body > /tmp/kanban-body.md
    # append "- [ ] #<new>" under a "## Sub-issues (opened by /gx-go)" heading
    # (add the heading first if the body has none), then:
    gh issue edit <N> --body-file /tmp/kanban-body.md
    ```
  - (optional) `gh issue comment <N> --body "Subordinate issue #<new> opened by /gx-go for this change."`
- **Step 6's PR `Closes #<new>`** (the subordinate) — **NEVER `Closes #<N>`**. Leave
  `#<N>` OPEN; the kanban advances it to `DONE` later via `/gx-qa`/`/gx-qbugs` (once all
  its subordinates are closed + `/gx-qa` is green). The squash-merge therefore closes
  the subordinate but not the tracked kanban issue.
- **Record BOTH** `#<N>` (the tracked kanban issue) and `#<new>` (the subordinate)
  in the change file's **Links** (Step 5 skeleton).

## Step 3 — Log a timestamped timeline (as you work)

Every time you make an **important decision** or take a **notable action**,
append a timeline entry to the change file. Stamp each with `date '+%H:%M:%S'`
(or full datetime) captured at that moment. Log at least:

- the decision of what to build / key assumptions made,
- each test-suite run + its result counts,
- each commit + branch push,
- each GitHub **issue** created (with its URL),
- each GitHub **PR** opened (with its URL) and its merge,
- any blocker, deviation, or notable trade-off.

Add issue/PR URLs to BOTH the timeline AND the dedicated **Links** section
(Step 5) as Markdown links (`[#N](url)`) so they're clickable on GitHub.

## Step 4 — Finalize the change file

When the task is done (or has stopped):

```bash
END_HUMAN=$(date '+%Y-%m-%d %H:%M:%S %Z')
END_EPOCH=$(date +%s)
ELAPSED=$((END_EPOCH - START_EPOCH))      # seconds; render as e.g. "12m 3s"
```

Patch the top of the file: set **Ended** = `END_HUMAN`, **Elapsed** =
human-readable duration, and finalize the Tokens/Tools row. Make sure the
**Links** section lists every GitHub issue and PR as Markdown links.

Then **append a link to `.gainwix/<component>/.gainwix/<component>/CHANGELOG.md`** (create it if missing) — one Markdown
list item, newest at the top of the list, pointing at the new file:

```
- [<TS>-change](changes/<TS>-change.md) — <one-line task title> (<START_HUMAN>)
```

## Step 5 — The Markdown change-file skeleton

Write plain GitHub-Flavored Markdown (it renders inline on GitHub — that's why
this is `.md`, not `.html`). Fill every `{{…}}` placeholder; append rows to the
Timeline list and the Links lists as you go.

```markdown
# {{TASK_TITLE}}

_{{OPTIONAL_NOTE — e.g. "Interactive-mode run (no the backlog edit)." — omit this line if there's nothing to note}}_

| Field | Value |
|-------|-------|
| **Client** | {{CLIENT_AND_ENTRYPOINT_AND_VERSION}} |
| **Model(s)** | {{MODELS_USED}} |
| **{{TOKENS_OR_TOOLS_LABEL}}** | {{TOKENS_OR_TOOLS}} |
| **Started** | {{START_HUMAN}} |
| **Ended** | {{END_HUMAN}} |
| **Elapsed** | {{ELAPSED_HUMAN}} |

<!-- TOKENS_OR_TOOLS_LABEL is "Tokens" (with input/output/total) when exact usage
     is known; otherwise "Tools" with every tool + MCP server used. -->

## Task

> {{TASK_BODY_VERBATIM}}

<!-- Quote the task verbatim; prefix every line (incl. continuation lines) with "> ". -->

## Links

**GitHub issues**

- [#N — title](https://github.com/<owner>/<repo>/issues/N)
<!-- The change's OWN new issue (always). If the task tracked a kanban issue, list
     BOTH: the tracked kanban issue #<N> (label it "tracked kanban issue — stays
     open") AND the subordinate #<new> the PR closes. Or, if none: "- _None — <reason>._" -->

**Pull requests**

- [#N — title](https://github.com/<owner>/<repo>/pull/N) — merged @ `<sha>`
<!-- The PR Closes the change's own issue (#<new>) — the SUBORDINATE when a kanban
     issue is tracked; NEVER the tracked kanban issue #<N>. -->

## Timeline

- **HH:MM:SS** — decision/action…
- **HH:MM:SS** — …
```

## Step 6 — Report

Print a short roll-up to the operator: the task, the change file path
(`changes/<TS>-change.md`), the issue + PR URLs, merge SHA(s), test counts,
and the elapsed time. Mention that the run was recorded to the change file
(which renders on GitHub) and linked from `.gainwix/<component>/.gainwix/<component>/CHANGELOG.md`.

## Notes

- **Applies to ALL code changes — but NOT to queuing work.** Interactive prompts
  that don't type `/gx-go` still follow this workflow (autonomy preamble + worktree
  + one PR + change file + CHANGELOG link) — they just skip the the backlog (`.gainwix/<component>/backlog.html`) item
  read/edit. **However**, a prompt that *only* adds to the backlog/queue
  (appending to `.gainwix/<component>/inbox.md` or the backlog (`.gainwix/<component>/backlog.html`)) is NOT a code change: edit the
  queue file directly with NO change file and NO CHANGELOG entry (see the
  Exception near the top). This is also stated in CLAUDE.md so it holds even when
  `/gx-go` isn't invoked.
- **.gainwix/<component>/inbox.md is no longer part of `/gx-go`.** Do not read it, write it, or
  clear it. (`/gx-next` and `/gx-sing` may still reference it; that's out of scope for
  `/gx-go`.)
- **Never close the tracked kanban issue from `/gx-go`'s PR.** When the task tracks a
  kanban issue `#<N>` (`Tracks #<N>` / `[#<N>](<url>)` in its body), `/gx-go` STILL
  opens its own new issue, but makes it a SUBORDINATE of `#<N>` (`Part of #<N>` +
  a `- [ ] #<new>` entry under `## Sub-issues (opened by /gx-go)` in `#<N>`'s body),
  and the PR `Closes #<new>` (the subordinate) — **NEVER `Closes #<N>`**. `#<N>`
  stays OPEN; `/gx-qa`/`/gx-qbugs` advance it `WIP`→`DONE` later (all subordinates closed
  + `/gx-qa` green). Tasks with no tracked issue are unaffected (PR `Closes #<new>` as
  always).
- The change file is **append-as-you-go**, not written once at the end — so a
  crashed/interrupted run still leaves a partial, useful record.
- Removing the executed item from the backlog (`.gainwix/<component>/backlog.html`) (so it isn't re-run) happens in
  **backlog mode only**. In **interactive mode** the task came from the prompt,
  so leave the backlog (`.gainwix/<component>/backlog.html`)'s item list untouched (you still read its autonomy
  preamble). Never touch `.gainwix/<component>/inbox.md` in either mode.
- **Markdown, not HTML** — change files are plain GitHub-Flavored Markdown so
  they render inline on GitHub. Don't use raw HTML/CSS; keep it portable.
- **Coverage report travels with the change.** If running the test suite
  regenerates a coverage report, that report is part of the task's PR (committed
  alongside the code + the change file), and coverage stays at or above the
  project's threshold. Never ship a change leaving a regenerated coverage report
  uncommitted/stale.
