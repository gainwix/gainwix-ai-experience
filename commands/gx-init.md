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

   ⛔⛔ **Whatever they answer, their files are read, never rewritten.** "Read those in" means copying ideas *into* `.gainwix/<component>/inbox.md` — the original file stays byte for byte as it was. **Never offer to rewrite, reformat, re-head or "bring into line" an existing backlog, its preamble, `AGENTS.md`, `CLAUDE.md`, or any skill or agent file**, even when the repo's own `AGENTS.md` seems to ask for a format. If something there looks wrong, say so in one line and leave it. The first worry of every person who already has a working set-up is that `/gx` will overwrite it; this command must make that impossible, not unlikely.

3. **Agree the components.** If `detect` found more than one, ask which of them keep their own backlog — some teams run one queue across a whole repo, others one per deployable piece. If it found one, say so and move on rather than asking a question with a single answer. For each component agreed, ask for a **serial prefix** (2–4 letters, e.g. `AB` for an admin portal): it stamps every item's id, it is **permanent, and it is never reused**.

4. **Make room.** For each component:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs" create --component <name> --prefix <PREFIX>
   ```

   That writes `.gainwix/<component>/` with `backlog.html`, `in-progress.html`, `completed.html`, `inbox.md` (raw ideas — yours to type in), `CHANGELOG.md` and `changes/`, plus two shared files: `.gainwix/README.md` explaining that the directory is tool-managed, and `.gainwix/autonomy.md`, what `/gx-go`, `/gx-sing` and `/gx-ping` are pre-approved to do. **It never overwrites anything that already exists**, and it writes nothing to the repo root. It also lists `.DS_Store` and `.claude/worktrees/` in `.git/info/exclude` — your local, untracked ignore list — so Finder's hidden files and the build worktrees never show up as changes.

   **Fill in the project's commands.** Every run reads the install, test and lint commands from the table in `.gainwix/autonomy.md`; left as `<command>`, every run has to guess them. From what step 1 detected, propose the three commands with `AskUserQuestion` (detected values first, *"leave blank"* as an option), then pass the confirmed ones:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs" commands --install "<cmd>" --test "<cmd>" --lint "<cmd>"
   ```

   It fills only rows still showing `<command>` — a command someone already typed there is kept.

5. **Set up QA if they want it** — `qa/QA.md` and `qa/runner/` from `${CLAUDE_PLUGIN_ROOT}/templates/scaffold/qa/`, only if missing. Mention the one-time `cd qa/runner && npm install && npx playwright install chromium` before the first `/gx-qa`.

6. **Get `develop` ready — locally, on GitHub, and committed.** The dev commands use a `develop` trunk, and planning pushes straight to it, so a local-only or protected `develop` breaks `/gx-next` later with no warning now. Check, then fix what is missing (ask before each push):

   ```bash
   git rev-parse --verify --quiet develop || git branch develop   # create it locally if missing
   git checkout develop
   git add .gainwix && git commit -m "chore(gainwix): set up .gainwix for <component(s)>"
   git remote get-url origin && git push -u origin develop   # only when there is an origin
   gh auth status                                            # signed in to GitHub?
   ```

   - ⛔ **Commit `.gainwix/` here, on `develop`.** Left uncommitted, the next command trips over it.
   - **No `origin` remote:** say the workflow runs locally until they add one, and that `/gx-go` will ask before merging without a pull request.
   - **`gh` not signed in:** give `gh auth login`; pull requests, issues and squash-merges all need it.
   - **The push to `develop` is refused** (a protected branch): say plainly that `/gx-next` and `/gx-go` push to `develop`, and that they need direct pushes allowed on it, or someone with admin rights to relax the rule. Also check squash merging is allowed: `gh repo view --json squashMergeAllowed`.

7. Flag (don't fix) anything else worth knowing for a clean deploy later — e.g. a missing Dockerfile (note that buildpacks can handle it at deploy time).

8. Finish by telling them, plainly: what you created and what already existed, the commit you made and whether `develop` is on GitHub, that **the files under `.gainwix/` are managed by the tools and should not be hand-edited**, and that **`/gx-about` fills in the project overview next**, then `/gx-next`/`/gx-go` to build.

Keep it plain-spoken. I'm an app developer, not a platform engineer.
