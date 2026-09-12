---
name: gx-init
description: Set up this repo for the GainWix workflow — detect what it builds, ask how you already keep specs and backlogs, and make room under a hidden .gainwix/ directory (one folder per component, each with backlog.html, in-progress.html and completed.html). Never writes to the repo root. GCP sign-in and deploys come later, in /gx-gcp-deploy.
disable-model-invocation: true
---

Run the **deployment-workmate** onboarding playbook **in this conversation** for this repository — do not dispatch it as a background subagent (a subagent can't ask you interactive questions). First read `${CLAUDE_PLUGIN_ROOT}/agents/deployment-workmate.md` and follow it as your operating instructions; it owns the reasoning.

This sets up the repo. GCP sign-in and project selection happen later in `/gx-gcp-deploy` (and `/gx-sim`), so `/gx-init` runs fine with no Google account — even offline.

**Present any choice as an interactive question using the `AskUserQuestion` tool** (recommended option first/default) — never a "reply with a number" list.

Stay in the scaffolding lane: deploying, GCP sign-in, and writing `.gainwix/deploy-context.json` all belong to `/gx-gcp-deploy`.

1. Inspect the repo and detect the stack: language, framework, runtime, build method, port, env vars (for context — no cloud calls).

2. **Find out what this repo builds, and what you already have.**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs" detect
   ```

   It reports `components` (directories that build something) and `alreadyHas` (places you already keep specs, a backlog, or an inbox).

   ⛔ **`alreadyHas` is the half that matters. If it is not empty, ASK before creating anything.** Show what was found — `about/`, `active/`, `BACKLOG.md`, whatever it is — and ask whether to read those in, sit alongside them, or leave them alone entirely. Do not assume a missing file means a missing home: a repo can keep its specs in `about/specs/` and its backlog in `active/`, and every check for a file called `BACKLOG.md` will pass while being completely wrong.

3. **Agree the components.** If `detect` found more than one, ask which of them keep their own backlog — some teams run one queue across a whole repo, others one per deployable piece. If it found one, say so and move on rather than asking a question with a single answer. For each component agreed, ask for a **serial prefix** (2–4 letters, e.g. `AB` for an admin portal): it stamps every item's id, it is **permanent, and it is never reused**.

4. **Make room.** For each component:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs" create --component <name> --prefix <PREFIX>
   ```

   That writes `.gainwix/<component>/` with `backlog.html`, `in-progress.html`, `completed.html`, `CHANGELOG.md` and `changes/`, plus `.gainwix/README.md` explaining that the directory is tool-managed. **It never overwrites anything that already exists**, and it writes nothing to the repo root.

5. **Set up QA if they want it** — `qa/QA.md` and `qa/runner/` from `${CLAUDE_PLUGIN_ROOT}/templates/scaffold/qa/`, only if missing. Mention the one-time `cd qa/runner && npm install && npx playwright install chromium` before the first `/gx-qa`.

6. Note the trunk-branch convention — the dev commands use a `develop` trunk; tell them to create one (`git branch develop`) if the repo doesn't have it.

7. Flag (don't fix) anything else worth knowing for a clean deploy later — e.g. a missing Dockerfile (note that buildpacks can handle it at deploy time).

8. Finish by telling them, plainly: what you created and what already existed, that **the files under `.gainwix/` are managed by the tools and should not be hand-edited**, and that **`/gx-about` fills in the project overview next**, then `/gx-next`/`/gx-go` to build.

Keep it plain-spoken. I'm an app developer, not a platform engineer.
