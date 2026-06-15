---
name: gx-init
description: Set up this repo for the GainWix workflow — detect the stack and scaffold the dev-workflow files (ABOUT.md, ACTION-ITEMS.md, BACKLOG.md, CHANGELOG.md, changes/, qa/QA.md) the /gx-* commands need. Scaffolding only — it does NOT configure GCP and does not deploy.
disable-model-invocation: true
---

Run the **deployment-workmate** onboarding playbook **in this conversation** for this repository — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions; it owns the reasoning.

**`/gx-init` is scaffolding only — it does NOT touch GCP** (no sign-in, no project resolution, no region). All cloud configuration is owned by `/gx-gcp-deploy` (and `/gx-sim`), which resolve GCP access when you actually deploy. So this works with no Google account, no project, even offline.

**Present any choice as an interactive question using the `AskUserQuestion` tool** (recommended option first/default) — never a "reply with a number" list.

Run the **onboarding flow** only — do NOT deploy, do NOT authenticate to GCP, and do NOT write `.gainwix/deploy-context.json`.

1. Inspect the repo and detect the stack: language, framework, runtime, build method, port, env vars (for context — no cloud calls).
2. **Scaffold the dev workflow** (your "Scaffold the dev workflow" onboarding step): create any missing `ABOUT.md`, `ACTION-ITEMS.md`, `BACKLOG.md`, `CHANGELOG.md`, `changes/`, and `qa/QA.md` from `${CLAUDE_PLUGIN_ROOT}/templates/scaffold/` so the `/gx-go`/`/gx-next`/`/gx-qa` commands have what they need. **Never overwrite a file I already have.** Tell me what you created vs. what existed, that `qa/QA.md` is mine to fill in (and `/gx-qa` still needs a `qa/runner/` harness), and that **`/gx-about` will fill in `ABOUT.md` and seed `ACTION-ITEMS.md`** for me next. Confirm my trunk branch (the scaffold assumes `develop`).
3. Flag (don't fix) anything else worth knowing for a clean deploy later — e.g. a missing Dockerfile (note that buildpacks can handle it at deploy time).
4. Finish with a one-line "your repo's scaffolded — run `/gx-about` next to fill in ABOUT.md + seed your backlog, then `/gx-next`/`/gx-go` to build (or `/gx-gcp-deploy` when you're ready to ship)."

Keep it plain-spoken. I'm an app developer, not a platform engineer.
