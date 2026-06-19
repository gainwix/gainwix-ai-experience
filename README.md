# GainWix — agentic dev workflow for Claude Code

A set of `/gx` slash commands that drive an AI teammate through your whole build loop — **plan → build → QA → ship** — right inside [Claude Code](https://code.claude.com). You capture an idea; the commands take it to reviewed, merged code. **Deploying to Google Cloud Run is one of those commands**, not the whole story.

Distributed as a Claude Code plugin from this private marketplace.

> Install it and you get the `/gx` commands — no setup prompts, no cloud config up front.

---

## How it's built (the design in one breath)

- **Slash commands first.** The `/gx-*` commands are the product — thin entry points that run a workflow in your conversation: plan, build, QA, issue-tracking, and (when you want it) deploy. Most run right in the main chat.
- **An agent for the heavy reasoning.** The deploy/onboarding commands lean on [`agents/deployment-workmate.md`](agents/deployment-workmate.md), a persona that owns that reasoning; the other commands follow their own command playbooks.
- **GCP only when you deploy.** The deploy command talks to the external [Cloud Run MCP server](https://github.com/GoogleCloudPlatform/cloud-run-mcp) (wired in [`.mcp.json`](.mcp.json)) using your local `gcloud` — there's nothing to configure at install.
- **Hooks are the conscience.** [`hooks/gate-production.js`](hooks/gate-production.js) forces an interactive human approval before any production deploy — it can't be auto-approved.

---

## Install

### 1. Add the marketplace

From any Claude Code session:

```
/plugin marketplace add gainwix/gainwix-ai-experience
```

(Or, for a local clone: `/plugin marketplace add /path/to/gainwix-ai-experience`.)

### 2. Install the plugin

```
/plugin install gainwix@gainwix-workmates
```

### 3. That's it — no install config

The plugin installs with **no setup prompts**. You get the `/gx` commands right away. Nothing about GCP is asked up front; the deploy command handles cloud sign-in and project setup itself, only if and when you actually deploy.

### Prerequisites (only for the commands that need them)

- **Node.js** — used by the deploy command's Cloud Run MCP (via `npx`), the production gate, and the QA runner. Not needed for the planning/building commands.
- **gcloud CLI** — only for deploying. You don't sign in ahead of time; `/gx-gcp-deploy` opens the browser to sign you in when needed, and can find or create a project for you.
- **A Google Cloud billing account** — only to actually deploy (Cloud Run needs billing). Adding a card is the one step only you can do; the deploy command points you there if it's missing.

Authentication uses your own credentials under least privilege — nothing is hardcoded.

---

## Use

```
/gx                 # one-line map of every command
/gx-init            # set up the repo: detect the stack + scaffold the dev-workflow files
/gx-about           # interview to fill in ABOUT.md, then seed ACTION-ITEMS.md from it
/gx-next            # plan the top idea into a real, executable task
/gx-go              # build one task end-to-end → PR → merge, with a change record
/gx-sing            # run the whole list, one task at a time
/gx-ping            # run independent tasks in parallel
/gx-qa              # end-to-end QA run with a screenshotted report
/gx-gcp-deploy      # ship it to Google Cloud Run (one of the commands; /gx-deploy is an alias)
/gx-help <command>  # deep dive on any command
```

A typical loop: `/gx-init` → `/gx-about` → `/gx-next` → `/gx-go` (or `/gx-sing` to run the whole list). Deploy with `/gx-gcp-deploy` whenever you're ready.

### What the deploy command (`/gx-gcp-deploy`) does

Deploying is just one command, but it carries real weight, so here's the flow. (Condensed — `/gx-help gx-gcp-deploy` and [`agents/deployment-workmate.md`](agents/deployment-workmate.md) have the authoritative step-by-step.)

1. **Pre-flight git hygiene** — clean tree, merge to `main`, cut a release branch (confirmed with you first).
2. **Ensure GCP access** — resolves sign-in + project + region for you (browser approval only; never terminal commands). This command owns GCP setup — `/gx-init` doesn't touch it.
3. **Detect & classify** — your language/framework/runtime/port/env, and whether this is production.
4. **Plan** — the GCP infra needed (Cloud Run first; flags any database/networking/IAM), an estimated monthly cost, and the diff from what's already deployed.
5. **Ask the minimum** — at most 2–3 questions, recommended option pre-selected.
6. **Gate 1 — plan approval** — nothing is applied until you approve.
7. **Execute** — provisions and deploys through the Cloud Run MCP. No console, ever.
8. **Gate 2 — production promotion** — a mandatory human approval, enforced by a hook even in Auto mode.
9. **Artifact** — writes `created-deployment.md`: every resource, the live URL(s), how to roll back, how to scale.

Monitoring is intentionally **out of scope** for this build (the artifact leaves a marked `TODO`).

**Trust modes (deploy only).** Default is **suggest** — every gate is interactive. Say "auto" for a run to let Gate 1 self-approve high-confidence, non-production changes; **Gate 2 (production) is never auto-approved** — the `PreToolUse` hook turns it into an interactive prompt regardless.

---

## Command reference

**Get started**

| Command | Status | Purpose |
| :------ | :----- | :------ |
| `/gx` | ✅ | One-line orientation. |
| `/gx-help <cmd>` | ✅ | Deep dive on one command. |
| `/gx-init` | ✅ | Set up the repo: detect the stack + scaffold the dev-workflow files. |
| `/gx-about` | ✅ | Fill in `ABOUT.md` by interview, then seed `ACTION-ITEMS.md` from it. Run after `/gx-init`. |

**Build & ship the work** (ported from the AptonWorks dev pipeline — assume a `develop` trunk + the `ACTION-ITEMS.md`/`BACKLOG.md`/`changes/`/`qa/` conventions)

| Command | Status | Purpose |
| :------ | :----- | :------ |
| `/gx-next` | ✅ | Plan the top `ACTION-ITEMS.md` idea into a `BACKLOG.md` task. |
| `/gx-go` | ✅ | Run one task end-to-end (branch → test → PR → squash-merge) + a `changes/*.md` record. |
| `/gx-sing` | ✅ | Serial loop: plan one + ship one until both queues drain. |
| `/gx-ping` | ✅ | Parallel loop: conflict-free batch (worktree per item), serial merges. |
| `/gx-qa` | ✅ | End-to-end browser + API QA → screenshotted report. |
| `/gx-qbugs` | ✅ | File the latest QA run's failures as bug issues + fix tasks. |
| `/gx-qloop` | ✅ | qa → qbugs → ping until the suite is green. |
| `/gx-issue-add <text>` | ✅ | File a GitHub issue tagged `queued`. |
| `/gx-issue-list` | ✅ | View the `queued` queue, oldest-first (read-only). |
| `/gx-issue-pick` | ✅ | Dequeue oldest `queued` issues into `ACTION-ITEMS.md`. |
| `/gx-sweep` | ✅ | Prune old QA reports + merged branches. |

**Deploy** (one of the features)

| Command | Status | Purpose |
| :------ | :----- | :------ |
| `/gx-sim` | ✅ | Dry-run deploy plan (Gate 1 in isolation). Never applies. |
| `/gx-gcp-deploy` (`/gx-deploy`) | ✅ | Full deploy flow — handles its own GCP access (sign-in + project + region). |

**Coming soon**

| Command | Status | Purpose |
| :------ | :----- | :------ |
| `/gx-add`, `/gx-rm` | 🚧 | Add/remove connectors or MCPs. |
| `/gx-reset` | 🚧 | Reset plugin configuration. |
| `/gx-debug` | 🚧 | Diagnostics. |

🚧 = declared and discoverable, behavior coming in a later build.

---

## Local development & testing

See [TESTING.md](TESTING.md) for how to run the plugin from a local directory and validate it before publishing.

This is a **private** repository. Not for public distribution.
