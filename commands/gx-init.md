---
name: gx-init
description: Onboard this repo to GainWix — detect the stack, validate GCP access, confirm project/region, scaffold what's missing. Does not deploy.
disable-model-invocation: true
---

Hand off to the **deployment-workmate** agent to run onboarding for this repository.

Tell the agent: run the **onboarding flow** only — do NOT deploy and do NOT write `.gainwix/deploy-context.json`.

1. Inspect the repo and detect the stack: language, framework, runtime, build method, port, env vars.
2. Validate GCP access for project `${user_config.gcp_project}` and region `${user_config.gcp_region}` — prefer the Cloud Run MCP (`list-services` / `list-projects`), fall back to `gcloud` for auth checks.
3. Confirm project and region with me, and surface anything that needs my decision as a short options list (recommended first).
4. Scaffold or flag anything missing for a smooth deploy (e.g. a missing Dockerfile → offer buildpacks).
5. Finish with a one-line "you're ready — run /gx-gcp-deploy when you want to ship."

Keep it plain-spoken. I'm an app developer, not a platform engineer.
