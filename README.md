# GainWix — Cloud Deployment Workmate

An AI teammate that deploys your app to **Google Cloud Run** — without you needing to understand cloud infrastructure. You install it, you say **"deploy,"** and it does the heavy lifting: detects your stack, plans the infrastructure, shows you the cost, gets your approval, ships it, and writes down exactly what it created.

Built as a [Claude Code](https://code.claude.com) plugin, distributed from this private marketplace.

> Built for app developers (frontend/backend), not platform engineers. No IAM, no VPCs, no console clicking.

---

## How it's built (the design in one breath)

- **The workmate is an agent.** [`agents/deployment-workmate.md`](agents/deployment-workmate.md) is a persistent deployment persona that owns all the reasoning. The `/gx` commands are thin entry points that summon it — they don't script deployments.
- **GCP does the execution.** All real cloud operations go through the external [Google Cloud Run MCP server](https://github.com/GoogleCloudPlatform/cloud-run-mcp), wired in [`.mcp.json`](.mcp.json). We don't build or bundle our own MCP, and the developer never sees or configures it.
- **Hooks are the conscience.** [`hooks/gate-production.js`](hooks/gate-production.js) is a `PreToolUse` hook that makes the production-promotion gate a *guarantee*, not a prompt suggestion — it forces an interactive human approval on every production deploy, and it cannot be auto-approved.

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

### 3. Configure (prompted at install)

Claude Code prompts you for:

| Setting | Required | Notes |
| :------ | :------- | :---- |
| **GCP project ID** | no | The project to deploy into. Leave empty if you don't have one yet — `/gx-gcp-deploy` will find or create one for you when you deploy. |
| **GCP region** | no | Defaults to `us-central1`. |
| **Service account key** | no | Path to a JSON key. Leave empty to use your local `gcloud` Application Default Credentials. |
| **Trust mode** | no | `suggest` (default, every gate interactive) or `auto` (Gate 1 may auto-approve; production never does). |

The Cloud Run MCP is provisioned automatically from these values — there is no "connect your MCP" step.

### Prerequisites

- **Node.js** (the Cloud Run MCP runs via `npx`; the production gate runs via `node`).
- **gcloud CLI** installed (unless you supplied a service-account key). You don't need to sign in ahead of time — if your Google sign-in is missing or expired, the workmate refreshes it for you; your only step is approving access in the browser window it opens.
- **A Google Cloud billing account.** You do **not** need a GCP project (`/gx-gcp-deploy` creates one) or an organization (personal accounts don't have one). But Cloud Run requires billing, and adding a billing account (a card) is the one step only you can do, at <https://console.cloud.google.com/billing>. It's the single console visit this plugin will ever ask of you.

Authentication uses your own credentials under least privilege — nothing is hardcoded.

---

## Use

```
/gx                 # one-line map of every command
/gx-init            # set up the repo: detect stack + scaffold the dev-workflow files (no GCP, no deploy)
/gx-about           # fill in ABOUT.md by interview, then seed ACTION-ITEMS.md from it (run after /gx-init)
/gx-sim             # dry run: show the deploy plan (infra + cost + diff), then stop
/gx-gcp-deploy      # the headline: resolve GCP (sign-in + project) → detect → plan → approve → deploy → document
/gx-help <command>  # deep dive on any command
```

`/gx-deploy` is an alias for `/gx-gcp-deploy`.

### What a deploy does

A condensed view — `/gx-help gx-gcp-deploy` (and [`agents/deployment-workmate.md`](agents/deployment-workmate.md)) have the authoritative step-by-step.

1. **Pre-flight git hygiene** — clean tree, merge to `main`, cut a release branch (confirmed with you first).
2. **Ensure GCP access** — resolves sign-in + project + region for you (browser approval only; never terminal commands). This command owns GCP setup, not `/gx-init`.
3. **Detect & classify** — your language/framework/runtime/port/env, and whether this is production.
4. **Plan** — the GCP infra needed (Cloud Run first; flags any database/networking/IAM), an estimated monthly cost, and the diff from what's already deployed.
5. **Ask the minimum** — at most 2–3 questions, recommended option pre-selected.
6. **Gate 1 — plan approval** — nothing is applied until you approve.
7. **Execute** — provisions and deploys through the Cloud Run MCP. No console, ever.
8. **Gate 2 — production promotion** — a mandatory human approval, enforced by a hook even in Auto mode.
9. **Artifact** — writes `created-deployment.md`: every resource, the live URL(s), how to roll back, how to scale.

Monitoring is intentionally **out of scope** for this build (the artifact leaves a marked `TODO`).

### Trust modes

- **Suggest** (default): every gate is interactive. Human-first.
- **Auto**: Gate 1 may be auto-approved for high-confidence, non-production changes. **Gate 2 (production) is never auto-approved** — the `PreToolUse` hook turns it into an interactive permission prompt regardless of mode.

---

## Command reference

**Deploy**

| Command | Status | Purpose |
| :------ | :----- | :------ |
| `/gx` | ✅ | One-line orientation. |
| `/gx-help <cmd>` | ✅ | Deep dive on one command. |
| `/gx-init` | ✅ | Set up the repo: detect stack + scaffold the dev-workflow files. No GCP, no deploy. |
| `/gx-about` | ✅ | Fill in `ABOUT.md` by interview, then seed `ACTION-ITEMS.md` from it. Run after `/gx-init`. |
| `/gx-sim` | ✅ | Dry-run plan (Gate 1 in isolation). Never applies. |
| `/gx-gcp-deploy` (`/gx-deploy`) | ✅ | Full deploy flow — owns GCP access (sign-in + project + region). |

**Dev workflow** (ported from the AptonWorks dev pipeline — assume a `develop` trunk + the `ACTION-ITEMS.md`/`BACKLOG.md`/`changes/`/`qa/` conventions)

| Command | Status | Purpose |
| :------ | :----- | :------ |
| `/gx-go` | ✅ | Run one task end-to-end (branch → test → PR → squash-merge) + a `changes/*.md` record. |
| `/gx-next` | ✅ | Plan the top `ACTION-ITEMS.md` idea into a `BACKLOG.md` task. |
| `/gx-sing` | ✅ | Serial loop: plan one + ship one until both queues drain. |
| `/gx-ping` | ✅ | Parallel loop: conflict-free batch (worktree per item), serial merges. |
| `/gx-qa` | ✅ | End-to-end browser + API QA → screenshotted report. |
| `/gx-qbugs` | ✅ | File the latest QA run's failures as bug issues + fix tasks. |
| `/gx-qloop` | ✅ | qa → qbugs → ping until the suite is green. |
| `/gx-issue-add <text>` | ✅ | File a GitHub issue tagged `queued`. |
| `/gx-issue-list` | ✅ | View the `queued` queue, oldest-first (read-only). |
| `/gx-issue-pick` | ✅ | Dequeue oldest `queued` issues into `ACTION-ITEMS.md`. |
| `/gx-sweep` | ✅ | Prune old QA reports + merged branches. |

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
