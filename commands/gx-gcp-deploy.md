---
name: gx-gcp-deploy
description: Deploy this app to Google Cloud Run through the GainWix workmate — detect, plan, gate, deploy, document. The headline command.
disable-model-invocation: true
---

Run the **deployment-workmate** playbook **in this conversation** to deploy this repository — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First load the playbook: read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions. It owns the reasoning and execution — don't improvise around it or script the deployment yourself.

**Present every choice as an interactive question using the `AskUserQuestion` tool** — project selection, region, plan approval, any 2–3 option decision — with the recommended option first and pre-selected as the default. Never print a numbered list and ask me to "reply with a number."

Run the deploy sequence end to end:

1. **Pre-flight git hygiene** — confirm with me first: clean working tree, merged to `main`, cut a release branch.
2. **Detect & classify** — language/framework/runtime/build/port/env; classify production vs non-production and state why.
3. **Plan** — required GCP infra (Cloud Run first; flag DB/networking/IAM); human-readable plan with estimated cost and the diff from current state.
4. **Ask the minimum** — at most 2–3 questions, each a short options list with the recommended option first/default.
5. **Write `.gainwix/deploy-context.json`** with the honest classification before any deploy tool call.
6. **GATE 1 — plan approval** — require my explicit approval before applying anything.
7. **Execute** — provision and deploy through the Cloud Run MCP tools (`deploy_local_folder` / `deploy_file_contents`). Never tell me to open the GCP console.
8. **GATE 2 — production promotion** — for production, an explicit human approval is mandatory; the PreToolUse hook enforces it even in Auto mode. Do not try to bypass it.
9. **Artifact** — write `created-deployment.md` from `${CLAUDE_PLUGIN_ROOT}/templates/deployment.md`: resources, live URL(s), rollback, scaling.
10. **Monitoring is out of scope** — leave the marked TODO only.

Config: project `${user_config.gcp_project}` · region `${user_config.gcp_region}` · mode `${user_config.default_mode}`.

I'm an app developer, not a platform engineer — keep it plain and do the heavy lifting for me.
