---
name: gx-sim
description: Dry run — produce the full deploy plan (infra + cost + diff) and stop. Never applies anything. This is Gate 1 in isolation.
disable-model-invocation: true
---

Run the **deployment-workmate** playbook **in this conversation** to produce a **dry-run deploy plan** for this repository — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions.

If any choice is genuinely needed, **present it as an interactive question using the `AskUserQuestion` tool** (recommended option first/default) — never a "reply with a number" list.

This is a SIMULATION. You must:
1. Inspect the repo and detect the stack.
2. Classify the target as production vs non-production and state why.
3. **Ensure GCP access (read-only)** — authenticate and resolve/confirm a project via your **GCP access** procedure so you can read current cloud state. Do NOT create a project, change `gcloud` config, or cut a branch. (`/gx-init` never does this; the dry run does, read-only — it's a cloud command.)
4. Pick the target (static bucket / Cloud Run / GKE / VM) and plan the whole architecture it needs (compute + any Cloud SQL + VPC/IAM/secrets).
5. Read current cloud state with the right read-only tool — `list_services`/`get_service` (Cloud Run), `gcloud … describe`, or `terraform plan` — and show the diff.
6. Present the plan: what would be created/changed, an estimated monthly cost range, and the diff.

Then **STOP**. Do not apply anything. Do not write `.gainwix/deploy-context.json`. Do not call any deploy tool. End by stating exactly what `/gx-gcp-deploy` would do if I ran it.

No install config to read: resolve the project + region read-only during step 3 so you can read current cloud state (don't create or change anything).
