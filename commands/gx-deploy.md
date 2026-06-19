---
name: gx-deploy
description: Alias for /gx-gcp-deploy — deploy this app to Google Cloud through the GainWix workmate (bucket / Cloud Run / GKE / VM, plus Cloud SQL + networking).
disable-model-invocation: true
---

This is an alias for `/gx-gcp-deploy`.

Run the **deployment-workmate** playbook **in this conversation** to deploy this repository, exactly as `/gx-gcp-deploy` does — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions; it owns the reasoning and execution.

**Present every choice as an interactive question using the `AskUserQuestion` tool** (project, region, plan approval, any 2–3 option decision), recommended option first/default — never a "reply with a number" list.

Run the full deploy sequence: pre-flight git hygiene (confirm first) → **ensure GCP access** (this command, not `/gx-init`, owns GCP setup — if my sign-in/project/region aren't configured, resolve them yourself via your GCP access procedure: browser sign-in → resolve/create the project → confirm region) → **detect, pick target & classify** (bucket / Cloud Run / GKE / VM, plus any Cloud SQL + VPC/IAM; production vs non-production) → plan the architecture (multi-resource via Terraform; estimated cost + diff) → ask the minimum (2–3 options-list questions max) → write `.gainwix/deploy-context.json` with the honest classification → **GATE 1** plan approval → execute via the right tool (Cloud Run MCP / `gcloud storage` / Terraform + `gcloud` + `kubectl`) → **GATE 2** production promotion (mandatory human approval, hook-enforced across every path, even in Auto mode) → write `created-deployment.md` from `${CLAUDE_PLUGIN_ROOT}/templates/deployment.md`. Monitoring is out of scope (leave the TODO).

No install config to read: you resolve the project + region yourself during the run (and `gcloud` remembers them for next time). Trust mode defaults to **suggest** unless I say "auto" for this run.
