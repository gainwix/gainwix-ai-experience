---
name: gx-gcp-deploy
description: Deploy this app to Google Cloud through the GainWix workmate — it picks the target (static site → Cloud Storage bucket, app → Cloud Run), resolves GCP access (sign-in + project + region), then detect, plan, gate, deploy, document. Owns all the GCP setup.
disable-model-invocation: true
---

Run the **deployment-workmate** playbook **in this conversation** to deploy this repository — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First load the playbook: read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions. It owns the reasoning and execution — don't improvise around it or script the deployment yourself.

**Present every choice as an interactive question using the `AskUserQuestion` tool** — project selection, region, plan approval, any 2–3 option decision — with the recommended option first and pre-selected as the default. Never print a numbered list and ask me to "reply with a number."

Run the deploy sequence end to end:

1. **Pre-flight git hygiene** — confirm with me first: clean working tree, merged to `main`, cut a release branch.
2. **Ensure GCP access** — this command owns all cloud config (NOT `/gx-init`). If my sign-in is missing/expired or no project is set/reachable, resolve it yourself via your **GCP access** procedure (authenticate by opening the browser → resolve or create the project → confirm the region). Never hand me terminal commands. If GCP is already configured, just confirm the project + region and move on.
3. **Detect, pick target & classify** — language/framework/runtime/build/port/env; choose the target (**static site → Cloud Storage bucket**, **containerized app → Cloud Run**); classify production vs non-production and state why.
4. **Plan** — the GCP infra for the chosen target (a Cloud Run service, or a public Cloud Storage bucket for a static site; flag DB/networking/IAM if also needed); human-readable plan with estimated cost and the diff from current state.
5. **Ask the minimum** — at most 2–3 questions, each a short options list with the recommended option first/default.
6. **Write `.gainwix/deploy-context.json`** with the honest classification before any deploy tool call.
7. **GATE 1 — plan approval** — require my explicit approval before applying anything.
8. **Execute** — Cloud Run via the MCP tools (`deploy_local_folder` / `deploy_file_contents`); a static site via `gcloud storage` (build → upload → make public → set index/404). Never tell me to open the GCP console.
9. **GATE 2 — production promotion** — for production, an explicit human approval is mandatory; the PreToolUse hook enforces it even in Auto mode. Do not try to bypass it.
10. **Artifact** — write `created-deployment.md` from `${CLAUDE_PLUGIN_ROOT}/templates/deployment.md`: resources, live URL(s), rollback, scaling.
11. **Monitoring is out of scope** — leave the marked TODO only.

No install config to read: you resolve the project + region yourself in step 2 (and `gcloud` remembers them for next time). Trust mode defaults to **suggest** (every gate interactive) unless I say "auto" for this run.

I'm an app developer, not a platform engineer — keep it plain and do the heavy lifting for me.
