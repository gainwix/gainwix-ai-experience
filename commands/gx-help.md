---
name: gx-help
description: Deep dive on a single GainWix command — what it does, when to use it, and what to expect.
argument-hint: <command>
disable-model-invocation: true
---

The developer wants a deep dive on a specific GainWix command: **$ARGUMENTS**

Explain that one command in depth — its purpose, exactly what happens when they run it, what it will and won't do, which gates apply, and when to reach for it. Be concrete and plain-spoken. Reference the canonical behavior below; do not invent capabilities.

- **/gx-init** — Onboarding. Inspects the repo to detect language/framework/runtime/port/env vars, validates GCP access (credentials, project, region) through the Cloud Run MCP, confirms `gcp_project`/`gcp_region`, and **scaffolds the dev-workflow files** the `/gx-*` commands need — creating any missing `ABOUT.md`, `ACTION-ITEMS.md`, `BACKLOG.md`, `CHANGELOG.md`, `changes/`, and `qa/QA.md` from the bundled templates (never overwriting existing files). Does NOT deploy.
- **/gx-sim** — Dry run. Produces the full deploy plan: infrastructure to be created, estimated monthly cost, and the diff from current cloud state — then STOPS. This is Gate 1 in isolation. Applies nothing.
- **/gx-gcp-deploy** (alias **/gx-deploy**) — The full deploy flow: pre-flight git hygiene → detect & classify (production vs non-production) → plan → ask the minimum → Gate 1 (plan approval) → execute via Cloud Run MCP → Gate 2 (production promotion, human approval, hook-enforced even in Auto mode) → write `created-deployment.md`. Monitoring is out of scope.
- **Trust modes** — Suggest (default): every gate interactive. Auto: Gate 1 may auto-approve for high-confidence non-production changes; Gate 2 is never auto-approved.

Dev-workflow commands (the build/QA pipeline; their full recipes live in each command file under `${CLAUDE_PLUGIN_ROOT}/commands/` — read that file for the authoritative behavior):
- **/gx-go** — Run one code-changing task end-to-end under the `BACKLOG.md` autonomy preamble: branch → test → commit → push → issue → PR → squash-merge, and record a timestamped `changes/*.md` (linked from `CHANGELOG.md`). Backlog mode takes the top `BACKLOG.md` task; interactive mode takes the prompt. Mandatory for code changes; never touches `ACTION-ITEMS.md`.
- **/gx-next** — Plan the top raw idea in `ACTION-ITEMS.md` into a detailed executable task appended to `BACKLOG.md`. Plans only (no code); moves a tracked issue `queued`→`WIP`.
- **/gx-sing** — Serial loop of `/gx-next` + `/gx-go`: plan one, ship one, repeat until both queues empty.
- **/gx-ping** — Parallel sibling of `/gx-sing`: build a conflict-free batch (≤5, one worktree each), integrate serially (rebase → re-test → squash-merge).
- **/gx-qa** — End-to-end QA: boot the stack, run every `qa/QA.md` workflow through Playwright/chromium, screenshot each step, emit `qa/RUN-REPORT-<ts>.html`, triage failures (frontend vs backend). Operational (commits `qa/` artifacts); not a `/gx-go` change.
- **/gx-qbugs** — Triage the latest `/gx-qa` run's failures into discrete bug GitHub issues + `ACTION-ITEMS.md` fix tasks (idempotent via `[QA:<slug>]`).
- **/gx-qloop** — Convergence loop: `/gx-qa` → `/gx-qbugs` → `/gx-ping` until a QA run is green (bounded by a max-iteration / no-progress / nothing-to-fix cap).
- **/gx-issue-add `<text>`** — File a well-formed GitHub issue tagged `queued`.
- **/gx-issue-list** — List the `queued` issues oldest-first (read-only).
- **/gx-issue-pick** — Dequeue the oldest `queued` issues into `ACTION-ITEMS.md` (FIFO), removing the `queued` label.
- **/gx-sweep** — Repo hygiene: prune old local QA reports, then delete merged remote/local branches + their worktrees.
- **Note on conventions:** these commands assume the repo's workflow conventions (a `develop` trunk, `ACTION-ITEMS.md` / `BACKLOG.md` / `changes/` / `CHANGELOG.md` / `qa/`, GitHub `queued`/`WIP`/`DONE`/`bug` labels) and, for `/gx-qa`, a Playwright runner under `qa/runner/`. They're ported faithfully from the AptonWorks dev workflow.
- **/gx-add, /gx-rm, /gx-reset, /gx-debug** — declared but not yet implemented; describe their intended purpose and say they're coming soon.

If `$ARGUMENTS` is empty, tell them to run `/gx` for the overview or pass a command name, e.g. `/gx-help gx-gcp-deploy`.
