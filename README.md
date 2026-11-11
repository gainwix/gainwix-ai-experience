# GainWix — agentic dev workflow for Claude Code

A set of `/gx` slash commands that drive an AI teammate through your whole build loop — **plan → build → QA → ship** — right inside [Claude Code](https://code.claude.com). You capture an idea; the commands take it to reviewed, merged code. **Deploying to Google Cloud Run is one of those commands**, not the whole story.

Distributed as a Claude Code plugin from this private marketplace.

> Install it and you get the `/gx` commands — no setup prompts, no cloud config up front.

---

## How it's built (the design in one breath)

- **Slash commands first.** The `/gx-*` commands are the product — thin entry points that run a workflow in your conversation: plan, build, QA, issue-tracking, and (when you want it) deploy. Most run right in the main chat.
- **An agent for the heavy reasoning.** The deploy/onboarding commands lean on [`agents/deployment-workmate.md`](agents/deployment-workmate.md), a persona that owns that reasoning; the other commands follow their own command playbooks.
- **GCP only when you deploy.** The deploy command talks to the external [Cloud Run MCP server](https://github.com/GoogleCloudPlatform/cloud-run-mcp) (wired in [`.mcp.json`](.mcp.json)) using your local `gcloud` — there's nothing to configure at install.
- **Hooks are the conscience.** [`hooks/gate-production.js`](hooks/gate-production.js) forces an interactive human approval before any production deploy — it can't be auto-approved. It covers **every** path — Cloud Run (MCP), the `gcloud storage` bucket path, and `terraform`/`gcloud`/`kubectl` for GKE/VM/Cloud SQL — which is why it also runs on `Bash`; see [`hooks/README.md`](hooks/README.md) for that design note and the tradeoff.

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
/gx-sing            # run one wave, one task at a time, then stop
/gx-ping            # run one wave, its tasks at the same time, then stop
/gx-qa              # end-to-end QA run with a screenshotted report
/gx-gcp-deploy      # ship it to Google Cloud Run (one of the commands; /gx-deploy is an alias)
/gx-help <command>  # deep dive on any command
```

A typical loop: `/gx-init` → `/gx-about` → `/gx-next` → `/gx-go` (or `/gx-sing` to run a whole wave). ⛔ **`/gx-sing` and `/gx-ping` run one wave and stop** — the next wave needs the last one merged, so run them again. Deploy with `/gx-gcp-deploy` whenever you're ready.

### What the deploy command (`/gx-gcp-deploy`) does

Deploying is just one command, but it carries real weight, so here's the flow. (Condensed — `/gx-help gx-gcp-deploy` and [`agents/deployment-workmate.md`](agents/deployment-workmate.md) have the authoritative step-by-step.)

1. **Pre-flight git hygiene** — clean tree, merge to `main`, cut a release branch (confirmed with you first).
2. **Ensure GCP access** — resolves sign-in + project + region for you (browser approval only; never terminal commands). This command owns GCP setup — `/gx-init` doesn't touch it.
3. **Detect, pick target & classify** — your language/framework/runtime/port/env; the right target (**static site → bucket**, **containerized app → Cloud Run**, **many services → GKE**, **stateful/always-on → a VM**), whether it needs a **Cloud SQL** database, and whether this is production.
4. **Plan** — the whole architecture for that target (compute + any Cloud SQL + VPC/IAM/secrets), an honest estimated monthly cost (a bucket is pennies and Cloud Run scales to zero, but a GKE cluster / always-on VM + Cloud SQL is real ongoing money), and the diff. Anything multi-resource is planned with **Terraform** (a `terraform plan` you approve before apply).
5. **Ask the minimum** — at most 2–3 questions, recommended option pre-selected.
6. **Gate 1 — plan approval** — nothing is applied until you approve.
7. **Execute** — Cloud Run through the MCP; a static site to a bucket via `gcloud`; GKE / VM / Cloud SQL / VPC / IAM via **Terraform** (+ `gcloud`/`kubectl`). No console, ever. Database passwords go to Secret Manager — never printed or committed.
8. **Gate 2 — production promotion** — a mandatory human approval, enforced by a hook even in Auto mode — across **every** path (Cloud Run, bucket, `terraform apply`, `kubectl apply`, `gcloud compute/sql/container`).
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

**Build & ship the work** (ported from the AptonWorks dev pipeline — assume a `develop` trunk; the queue lives under `.gainwix/<component>/`, `qa/` stays where the developer put it)

| Command | Status | Purpose |
| :------ | :----- | :------ |
| `/gx-next` | ✅ | Plan the top `ACTION-ITEMS.md` idea into a `BACKLOG.md` task. |
| `/gx-go` | ✅ | Run one task end-to-end (branch → test → PR → squash-merge) + a `changes/*.md` record. |
| `/gx-sing` | ✅ | One wave, worked one item at a time, each merged before the next — then stop. |
| `/gx-ping` | ✅ | One wave, its items built at the same time (worktree each), merged serially — then stop. |
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
| `/gx-gcp-deploy` (`/gx-deploy`) | ✅ | Full deploy flow — picks the target (bucket / Cloud Run / GKE / VM), provisions the architecture incl. Cloud SQL + VPC/IAM (Terraform/gcloud), and handles its own GCP access. |

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
