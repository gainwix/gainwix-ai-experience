---
name: gx-help
description: Deep dive on a single GainWix command — what it does, when to use it, and what to expect.
argument-hint: <command>
disable-model-invocation: true
---

The developer wants a deep dive on a specific GainWix command: **$ARGUMENTS**

Explain that one command in depth — its purpose, exactly what happens when they run it, what it will and won't do, which gates apply, and when to reach for it. Be concrete and plain-spoken. Reference the canonical behavior below; do not invent capabilities.

- **/gx-init** — Onboarding. Inspects the repo to detect language/framework/runtime/port/env vars, validates GCP access (credentials, project, region) through the Cloud Run MCP, confirms `gcp_project`/`gcp_region` with the developer, and scaffolds anything missing. Does NOT deploy.
- **/gx-sim** — Dry run. Produces the full deploy plan: infrastructure to be created, estimated monthly cost, and the diff from current cloud state — then STOPS. This is Gate 1 in isolation. Applies nothing.
- **/gx-gcp-deploy** (alias **/gx-deploy**) — The full deploy flow: pre-flight git hygiene → detect & classify (production vs non-production) → plan → ask the minimum → Gate 1 (plan approval) → execute via Cloud Run MCP → Gate 2 (production promotion, human approval, hook-enforced even in Auto mode) → write `created-deployment.md`. Monitoring is out of scope.
- **Trust modes** — Suggest (default): every gate interactive. Auto: Gate 1 may auto-approve for high-confidence non-production changes; Gate 2 is never auto-approved.
- **/gx-add, /gx-rm, /gx-reset, /gx-issue, /gx-next, /gx-go, /gx-debug** — declared but not yet implemented in this build; describe their intended purpose and say they're coming soon.

If `$ARGUMENTS` is empty, tell them to run `/gx` for the overview or pass a command name, e.g. `/gx-help gx-gcp-deploy`.
