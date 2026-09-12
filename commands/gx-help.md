---
name: gx-help
description: Deep dive on a single GainWix command — what it does, when to use it, and what to expect.
argument-hint: <command>
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

The developer wants a deep dive on a specific GainWix command: **$ARGUMENTS**

Explain that one command in depth — its purpose, exactly what happens when they run it, what it will and won't do, which gates apply, and when to reach for it. Be concrete and plain-spoken. Reference the canonical behavior below; do not invent capabilities.

- **/gx-init** — Repo setup. Detects the stack (for context) and **scaffolds the dev-workflow files** the `/gx-*` commands need — creating any missing `ABOUT.md`, `.gainwix/<component>/inbox.md`, the backlog (`.gainwix/<component>/backlog.html`), `.gainwix/<component>/CHANGELOG.md`, `changes/`, and `qa/QA.md` from the bundled templates (never overwriting existing files). GCP sign-in and deploys come later in `/gx-gcp-deploy`, so `/gx-init` runs with no Google account, even offline.
- **/gx-about** — Product discovery, run **after `/gx-init`** (which only scaffolds the empty templates). Inspects the repo, then **interviews you** (asking the "why" the code can't reveal) to fill in `ABOUT.md` — the product source-of-truth — then runs `ABOUT.md`'s built-in "generate features" prompt to **seed `.gainwix/<component>/inbox.md`** with a prioritized, dependency-ordered list of raw feature ideas. A human **verification gate** after each step (approve/revise the `ABOUT.md`, then the seeded list). Writes only those two files — it doesn't run code or deploy. The bridge from scaffolding to building (`/gx-next` → `/gx-go`).
- **/gx-sim** — Dry run. Detects + classifies, **ensures GCP access read-only** (sign-in + resolve/confirm a project so it can read current state — never creates a project or cuts a branch), then produces the full plan (infra + estimated monthly cost + diff from current cloud state) and STOPS. Gate 1 in isolation. Applies nothing.
- **/gx-gcp-deploy** (alias **/gx-deploy**) — The full deploy flow, and the command that **owns all GCP configuration**: pre-flight git hygiene → **ensure GCP access** (resolve sign-in + project + region itself — never terminal homework) → detect, **pick the target**, & classify (**static site → bucket** via `gcloud`; **app → Cloud Run** via the MCP; **many services → GKE**; **stateful/always-on → a VM**; plus **Cloud SQL** + VPC/IAM/Secret-Manager when needed) → plan the whole architecture (multi-resource via **Terraform**, with a `terraform plan` you approve) → ask the minimum → Gate 1 (plan approval) → execute (Cloud Run MCP, or `gcloud`/`terraform`/`kubectl`) → Gate 2 (production promotion, human approval, hook-enforced across **every** path — Cloud Run, bucket, `terraform apply`, `kubectl apply`, `gcloud compute/sql/container` — even in Auto mode) → write `created-deployment.md`. Monitoring is out of scope.
- **Trust modes** — Suggest (default): every gate interactive. Auto: Gate 1 may auto-approve for high-confidence non-production changes; Gate 2 is never auto-approved.

Dev-workflow commands (the build/QA pipeline; their full recipes live in each command file under `${CLAUDE_PLUGIN_ROOT}/commands/` — read that file for the authoritative behavior):
- **/gx-go** — Run one code-changing task end-to-end under the `.gainwix/autonomy.md` preamble: branch → test → commit → push → issue → PR → squash-merge, and record a timestamped `.gainwix/<component>/changes/*.md` (linked from `.gainwix/<component>/CHANGELOG.md`). Backlog mode takes the next item from the wave that can start; interactive mode takes the prompt. Mandatory for code changes; never touches `.gainwix/<component>/inbox.md`.
- **/gx-next** — Plan the top raw idea in `.gainwix/<component>/inbox.md` into a detailed executable task appended to the backlog (`.gainwix/<component>/backlog.html`). Plans only (no code); moves a tracked issue `queued`→`WIP`.
- **/gx-sing** — Serial loop of `/gx-next` + `/gx-go`: plan one, ship one, repeat until both queues empty.
- **/gx-ping** — Parallel sibling of `/gx-sing`: build a conflict-free batch (≤5, one worktree each), integrate serially (rebase → re-test → squash-merge).
- **/gx-qa** — End-to-end QA: boot the stack, run every `qa/QA.md` workflow through Playwright/chromium, screenshot each step, emit `qa/RUN-REPORT-<ts>.html`, triage failures (frontend vs backend). Operational (commits `qa/` artifacts); not a `/gx-go` change.
- **/gx-qbugs** — Triage the latest `/gx-qa` run's failures into discrete bug GitHub issues + fix idea in `.gainwix/<component>/inbox.md`s (idempotent via `[QA:<slug>]`).
- **/gx-qloop** — Convergence loop: `/gx-qa` → `/gx-qbugs` → `/gx-ping` until a QA run is green (bounded by a max-iteration / no-progress / nothing-to-fix cap).
- **/gx-issue-add `<text>`** — File a well-formed GitHub issue tagged `queued`.
- **/gx-issue-list** — List the `queued` issues oldest-first (read-only).
- **/gx-issue-pick** — Dequeue the oldest `queued` issues into `.gainwix/<component>/inbox.md` (FIFO), removing the `queued` label.
- **/gx-sweep** — Repo hygiene: prune old local QA reports, then delete merged remote/local branches + their worktrees.
- **Note on conventions:** these commands assume the repo's workflow conventions (a `develop` trunk, the inbox and the backlog / `changes/` / `.gainwix/<component>/CHANGELOG.md` / `qa/`, GitHub `queued`/`WIP`/`DONE`/`bug` labels). `/gx-init` scaffolds the `/gx-qa` Playwright runner under `qa/runner/` (one-time `npm install` + `npx playwright install chromium` before the first run). They're ported from the AptonWorks dev workflow.
- **/gx-add, /gx-rm, /gx-reset, /gx-debug** — declared but not yet implemented; describe their intended purpose and say they're coming soon.

If `$ARGUMENTS` is empty, tell them to run `/gx` for the overview or pass a command name, e.g. `/gx-help gx-gcp-deploy`.
