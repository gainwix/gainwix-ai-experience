---
name: gx-deploy
description: Alias for /gx-gcp-deploy — deploy this app to Google Cloud Run through the GainWix workmate.
disable-model-invocation: true
---

This is an alias for `/gx-gcp-deploy`.

Hand off to the **deployment-workmate** agent to run the **full deploy flow** for this repository, exactly as `/gx-gcp-deploy` does. You are an entry point only — the agent owns the reasoning and execution; do not script the deployment yourself.

Run the agent's full deploy sequence: pre-flight git hygiene (confirm first) → detect & classify (production vs non-production) → plan (infra + estimated cost + diff) → ask the minimum (2–3 options-list questions max) → write `.gainwix/deploy-context.json` with the honest classification → **GATE 1** plan approval → execute via the Cloud Run MCP tools → **GATE 2** production promotion (mandatory human approval, hook-enforced even in Auto mode) → write `created-deployment.md` from `${CLAUDE_PLUGIN_ROOT}/templates/deployment.md`. Monitoring is out of scope (leave the TODO).

Config: project `${user_config.gcp_project}` · region `${user_config.gcp_region}` · mode `${user_config.default_mode}`.
