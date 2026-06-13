---
name: gx-deploy
description: Alias for /gx-gcp-deploy — deploy this app to Google Cloud Run through the GainWix workmate.
disable-model-invocation: true
---

This is an alias for `/gx-gcp-deploy`.

Run the **deployment-workmate** playbook **in this conversation** to deploy this repository, exactly as `/gx-gcp-deploy` does — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions; it owns the reasoning and execution.

**Present every choice as an interactive question using the `AskUserQuestion` tool** (project, region, plan approval, any 2–3 option decision), recommended option first/default — never a "reply with a number" list.

Run the full deploy sequence: pre-flight git hygiene (confirm first) → **ensure GCP access** (this command, not `/gx-init`, owns GCP setup — if my sign-in/project/region aren't configured, resolve them yourself via your GCP access procedure: browser sign-in → resolve/create the project → confirm region) → detect & classify (production vs non-production) → plan (infra + estimated cost + diff) → ask the minimum (2–3 options-list questions max) → write `.gainwix/deploy-context.json` with the honest classification → **GATE 1** plan approval → execute via the Cloud Run MCP tools → **GATE 2** production promotion (mandatory human approval, hook-enforced even in Auto mode) → write `created-deployment.md` from `${CLAUDE_PLUGIN_ROOT}/templates/deployment.md`. Monitoring is out of scope (leave the TODO).

Config: project `${user_config.gcp_project}` · region `${user_config.gcp_region}` · mode `${user_config.default_mode}`.
