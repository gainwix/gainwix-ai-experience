---
name: gx-init
description: Onboard this repo to GainWix — detect the stack, validate GCP access, confirm project/region, scaffold what's missing. Does not deploy.
disable-model-invocation: true
---

Run the **deployment-workmate** onboarding playbook **in this conversation** for this repository — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions; it owns the reasoning.

**Present every choice as an interactive question using the `AskUserQuestion` tool** — project selection, region, any 2–3 option decision — recommended option first/default. Never print a numbered list and ask me to "reply with a number."

Run the **onboarding flow** only — do NOT deploy and do NOT write `.gainwix/deploy-context.json`.

1. Inspect the repo and detect the stack: language, framework, runtime, build method, port, env vars.
2. Resolve GCP access (I may not have a project yet — that's fine):
   - If my Google sign-in is missing or expired, refresh it yourself via your Authentication flow — my only step is approving in the browser. Never hand me terminal commands to run.
   - If a project is configured (`${user_config.gcp_project}`), validate it and region `${user_config.gcp_region}` — prefer the Cloud Run MCP (`list_services` / `list_projects`), fall back to `gcloud` for auth checks.
   - If no project is configured or it's unreachable, list my projects and let me pick — or, if I have none, offer to create one for me (suggest an ID from the repo name). If my account has no billing account, point me at the console billing page (the one manual step) and resume once it exists.
3. Confirm project and region with me, and surface anything that needs my decision as a short options list (recommended first).
4. Scaffold or flag anything missing for a smooth deploy (e.g. a missing Dockerfile → offer buildpacks).
5. Finish with a one-line "you're ready — run /gx-gcp-deploy when you want to ship."

Keep it plain-spoken. I'm an app developer, not a platform engineer.
