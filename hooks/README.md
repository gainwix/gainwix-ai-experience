# Hooks — the production gate (Gate 2)

[`gate-production.js`](gate-production.js), wired by [`hooks.json`](hooks.json), is
the deterministic enforcement of **Gate 2: a production deploy requires explicit
human approval.** It runs as a `PreToolUse` hook and, for a production deploy,
returns `permissionDecision: "ask"` — which forces Claude Code to surface a
permission prompt. Auto mode cannot satisfy an `"ask"` on its own, so the gate
holds **even in Auto mode**. This is a guarantee, not prompt-text politeness.

Classification comes from `<cwd>/.gainwix/deploy-context.json` (`target`, `kind`),
written by the deploy agent during planning. Fail-safe: if that file is missing,
unreadable, or the deploy inputs look production-like, the deploy is treated as
production and gated.

## What it intercepts — and the deliberate tradeoff (read this before "fixing" it)

The gate must cover **both** deploy paths, which reach GCP differently:

| Deploy path | How it reaches GCP | How the gate catches it |
| :---------- | :----------------- | :---------------------- |
| **Cloud Run** | the Cloud Run **MCP** tools (`mcp__cloud-run__deploy*`) | a clean tool-name matcher in `hooks.json` |
| **Static site → Cloud Storage bucket** | **`gcloud storage` via Bash** (no bucket-deploy MCP is wired) | a `Bash` matcher in `hooks.json` |

Because the bucket path is plain `gcloud` (not an MCP tool), the only deterministic
chokepoint for it is a **`PreToolUse` hook on the `Bash` tool**. So, by design:

> **The gate runs a quick `node` check on *every* `Bash` tool call.**

For any command that isn't a bucket publish (`gcloud storage rsync|cp … gs://`,
`buckets add-iam-policy-binding`, `buckets update … --web-…`, or the `gsutil`
equivalents), the script **exits 0 immediately** — no decision, no output, no
interference. The cost is one fast `node` spawn per Bash call: functionally
invisible, but real, and it touches *all* Bash in every session where the plugin
is enabled. That is the price of enforcing Gate 2 on the gcloud path, and it's
intentional — not a bug.

## If you want to narrow it later

- **Best:** if a deploy-capable Cloud Storage MCP gets wired in (see
  `agents/deployment-workmate.md` step 8), move the bucket publish onto that MCP
  tool and drop the `Bash` matcher — the gate then matches only MCP deploy tools
  again, with zero per-Bash overhead.
- Or, if Claude Code adds command-level (not just tool-name) hook matching, tighten
  the `Bash` matcher to the `gcloud storage` / `gsutil` publish commands.
- Or, route every bucket publish through one named wrapper script and match only
  that.

Until then, the broad `Bash` matcher + instant-defer script is the simplest way to
keep the production guarantee honest across both deploy paths.

## See also

- `agents/deployment-workmate.md` — step 6 (writes `deploy-context.json`) and
  step 9 (Gate 2), which this hook enforces.
- `TESTING.md` §5 — unit tests for the gate (Cloud Run + bucket, prod / non-prod /
  missing-context, and "ordinary Bash is never touched").
