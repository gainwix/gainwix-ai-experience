---
name: gx
description: One-line orientation to every GainWix /gx command.
disable-model-invocation: true
---

You are showing the developer a quick map of the GainWix Cloud Deployment Workmate. Print exactly this, then stop — do not take any other action:

**GainWix — Cloud Deployment Workmate + dev workflow.** Ship to Google Cloud and run your build/QA pipeline, all from `/gx`.

Deploy:
- `/gx` — this orientation.
- `/gx-help <command>` — deep dive on one command.
- `/gx-init` — onboard: detect your stack, check GCP access, confirm project/region.
- `/gx-sim` — dry run: show the deploy plan (infra + cost + diff) and stop. Never applies.
- `/gx-gcp-deploy` — the headline: detect → plan → approve → deploy → document. (`/gx-deploy` is an alias.)

Build & ship (changes → PR + change record):
- `/gx-go` — run one task end-to-end (branch → test → PR → squash-merge) + a `changes/*.md` record.
- `/gx-next` — plan the top `ACTION-ITEMS.md` idea into a `BACKLOG.md` task.
- `/gx-sing` — serial loop: plan one + ship one, repeat until both queues drain.
- `/gx-ping` — parallel loop: build a conflict-free batch (worktree per item), merge serially.

QA:
- `/gx-qa` — end-to-end browser + API QA run → screenshotted report.
- `/gx-qbugs` — file the latest QA run's failures as bug issues + fix tasks.
- `/gx-qloop` — qa → qbugs → ping until the suite is green.

Issues (GitHub `queued` kanban):
- `/gx-issue-add <text>` — file an issue, tagged `queued`.
- `/gx-issue-list` — view the `queued` queue, oldest-first.
- `/gx-issue-pick` — dequeue the oldest `queued` issues into `ACTION-ITEMS.md`.

Hygiene:
- `/gx-sweep` — prune old QA reports + merged branches.

Coming soon:
- `/gx-add`, `/gx-rm` — add/remove connectors or MCPs. · `/gx-reset` — reset config. · `/gx-debug` — diagnostics.

Deploy path: `/gx-init` → `/gx-sim` → `/gx-gcp-deploy`. Dev path: `/gx-issue-add` → `/gx-issue-pick` → `/gx-next` → `/gx-go` (or `/gx-sing`).
