---
name: gx
description: One-line orientation to every GainWix /gx command.
disable-model-invocation: true
---

> Every file this command reads or writes is listed in
> `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md`, and every backlog read or
> write goes through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`.

You are showing the developer a quick map of GainWix — the `/gx` dev-workflow commands. Print exactly this, then stop — do not take any other action:

**GainWix — agentic dev workflow for Claude Code.** Plan, build, QA, and ship with `/gx` commands. (Deploying to Cloud Run is one of them.)

Get started:
- `/gx` — this orientation.
- `/gx-help <command>` — deep dive on one command.
- `/gx-init` — set up your repo: detect what it builds and make room under `.gainwix/`.
- `/gx-about` — fill in ABOUT.md by interview, then seed .gainwix/<component>/inbox.md from it. Run after `/gx-init`, before building.

Build & ship (changes → PR + change record):
- `/gx-next` — plan the top `.gainwix/<component>/inbox.md` idea into a backlog task.
- `/gx-go` — run one task end-to-end (branch → test → PR → squash-merge) + a `.gainwix/<component>/changes/*.md` record.
- `/gx-sing` — **one wave**, worked one item at a time, each merged before the next — then stop.
- `/gx-ping` — **one wave**, its items built at the same time (worktree each), merged serially — then stop.
  ⛔ Neither runs the queue to the bottom: the next wave needs this one **merged**. Run it again.

QA:
- `/gx-qa` — end-to-end browser + API QA run → screenshotted report.
- `/gx-qbugs` — file the latest QA run's failures as bug issues + fix tasks.
- `/gx-qloop` — qa → qbugs → ping until the suite is green.

Issues (GitHub `queued` kanban):
- `/gx-issue-add <text>` — file an issue, tagged `queued`.
- `/gx-issue-list` — view the `queued` queue, oldest-first.
- `/gx-issue-pick` — dequeue the oldest `queued` issues into `.gainwix/<component>/inbox.md`.

Deploy (one of the features):
- `/gx-sim` — dry run: show the deploy plan (infra + cost + diff) and stop. Never applies.
- `/gx-gcp-deploy` — ship to Google Cloud: picks the target (bucket / Cloud Run / GKE / VM), provisions the architecture incl. Cloud SQL + networking (Terraform/gcloud), signs you in, then plan → approve → deploy → document. (`/gx-deploy` is an alias.)

Hygiene:
- `/gx-sweep` — prune old QA reports + merged branches.

Coming soon:
- `/gx-add`, `/gx-rm` — add/remove connectors or MCPs. · `/gx-reset` — reset config. · `/gx-debug` — diagnostics.

Start with `/gx-init`, then `/gx-about` to fill ABOUT.md + seed your inbox. Build with `/gx-next` → `/gx-go` (or `/gx-sing`); capture work as issues first with `/gx-issue-add` → `/gx-issue-pick`. Ship with `/gx-gcp-deploy` whenever you're ready.
