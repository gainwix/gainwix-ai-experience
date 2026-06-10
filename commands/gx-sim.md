---
name: gx-sim
description: Dry run — produce the full deploy plan (infra + cost + diff) and stop. Never applies anything. This is Gate 1 in isolation.
disable-model-invocation: true
---

Hand off to the **deployment-workmate** agent to produce a **dry-run deploy plan** for this repository.

This is a SIMULATION. The agent must:
1. Inspect the repo and detect the stack.
2. Classify the target as production vs non-production and state why.
3. Determine the required GCP infrastructure (Cloud Run first; flag any database / networking / IAM separately).
4. Read current cloud state via the Cloud Run MCP (`list-services` / `get-service`) and show the diff.
5. Present the plan: what would be created/changed, an estimated monthly cost range, and the diff.

Then **STOP**. Do not apply anything. Do not write `.gainwix/deploy-context.json`. Do not call any deploy tool. End by stating exactly what `/gx-gcp-deploy` would do if I ran it.

Project: `${user_config.gcp_project}` · Region: `${user_config.gcp_region}`.
