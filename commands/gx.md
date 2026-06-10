---
name: gx
description: One-line orientation to every GainWix /gx command.
disable-model-invocation: true
---

You are showing the developer a quick map of the GainWix Cloud Deployment Workmate. Print exactly this, then stop — do not take any other action:

**GainWix — Cloud Deployment Workmate.** Ship your app to Google Cloud, no infra expertise needed.

Core:
- `/gx` — this orientation.
- `/gx-help <command>` — deep dive on one command.
- `/gx-init` — onboard: detect your stack, check GCP access, confirm project/region.
- `/gx-sim` — dry run: show the deploy plan (infra + cost + diff) and stop. Never applies.
- `/gx-gcp-deploy` — the headline: detect → plan → approve → deploy → document. (`/gx-deploy` is an alias.)

Config & workflow (coming soon):
- `/gx-add`, `/gx-rm` — add/remove connectors or MCPs.
- `/gx-reset` — reset plugin configuration.
- `/gx-issue add|list|rm` — track work.
- `/gx-next`, `/gx-go` — drive the workflow.
- `/gx-debug` — diagnostics.

Start with `/gx-init`, then `/gx-sim`, then `/gx-gcp-deploy`.
