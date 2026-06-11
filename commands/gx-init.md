---
name: gx-init
description: Onboard this repo to GainWix — detect the stack, validate GCP access, confirm project/region, scaffold what's missing. Does not deploy.
disable-model-invocation: true
---

Hand off to the **deployment-workmate** agent to run onboarding for this repository.

Tell the agent: run the **onboarding flow** only — do NOT deploy and do NOT write `.gainwix/deploy-context.json`.

1. Inspect the repo and detect the stack: language, framework, runtime, build method, port, env vars.
2. Resolve GCP access (I may not have a project yet — that's fine):
   - If a project is configured (`${user_config.gcp_project}`), validate it and region `${user_config.gcp_region}` — prefer the Cloud Run MCP (`list_services` / `list_projects`), fall back to `gcloud` for auth checks.
   - If no project is configured or it's unreachable, list my projects and let me pick — or, if I have none, offer to create one for me (suggest an ID from the repo name). If my account has no billing account, point me at the console billing page (the one manual step) and resume once it exists.
3. Confirm project and region with me, and surface anything that needs my decision as a short options list (recommended first).
4. Scaffold or flag anything missing for a smooth deploy (e.g. a missing Dockerfile → offer buildpacks).
5. Finish with a one-line "you're ready — run /gx-gcp-deploy when you want to ship."

Keep it plain-spoken. I'm an app developer, not a platform engineer.
