# Testing GainWix locally

How to validate and exercise the plugin before publishing the marketplace.

## 1. Validate the manifest

From the repo root:

```bash
claude plugin validate .
```

Fix any errors before going further. Warnings about unrecognized fields are non-fatal, but read them. For a stricter pass:

```bash
claude plugin validate . --strict
```

## 2. Load the plugin without publishing

You have two options.

### Option A — `--plugin-dir` (fastest iteration)

Point Claude Code at this directory directly. Components are picked up live:

```bash
claude --plugin-dir /path/to/gainwix-ai-experience
```

Then in the session:

```
/gx                 # should print the command map
/gx-help gx-sim     # should deep-dive that command
/agents             # deployment-workmate should be listed
```

After editing `hooks/`, `.mcp.json`, or `agents/`, run `/reload-plugins` or restart.

### Option B — local marketplace (closest to the real install)

This mirrors exactly what end users do.

```
/plugin marketplace add /path/to/gainwix-ai-experience
/plugin install gainwix@gainwix-workmates
```

You'll be prompted for the four config values (GCP project, region, key, mode).
Use a throwaway/sandbox GCP project for testing.

## 3. Smoke test the surface (no cloud needed)

These don't touch GCP:

- `/gx` — prints orientation.
- `/gx-help gx-gcp-deploy` — explains the flow.
- `/gx-add`, `/gx-debug`, etc. — each reports "coming soon" and does nothing.
- `/agents` — shows `gainwix:deployment-workmate`.

## 4. Verify the MCP is wired (invisible to the user)

With the plugin enabled and Node available, the `cloud-run` MCP server should start automatically. Check:

```
/mcp
```

You should see `cloud-run` connected, exposing tools like `list-services`,
`get-service`, `deploy-local-folder`. The developer never configured this — it
came from `.mcp.json` + your install-time config. If it shows as failed, confirm
Node/`npx` are installed and that `gcloud auth application-default login` (or a
service-account key) is in place.

## 5. Test the production gate (the important one)

The Gate 2 hook (`hooks/gate-production.js`) must force a human approval on
production deploys, even in Auto mode. You can unit-test it without deploying:

```bash
# Non-production -> defers (no decision, exit 0, no output)
mkdir -p /tmp/gxtest/.gainwix
printf '{"target":"non-production","service":"demo","reason":"feature branch"}' \
  > /tmp/gxtest/.gainwix/deploy-context.json
printf '{"cwd":"/tmp/gxtest","tool_name":"mcp__cloud-run__deploy-local-folder","tool_input":{}}' \
  | node hooks/gate-production.js; echo "exit=$?"
# Expect: no JSON output, exit=0

# Production -> asks (forces human approval)
printf '{"target":"production","service":"api","reason":"deploying main to prod"}' \
  > /tmp/gxtest/.gainwix/deploy-context.json
printf '{"cwd":"/tmp/gxtest","tool_name":"mcp__cloud-run__deploy-local-folder","tool_input":{}}' \
  | node hooks/gate-production.js; echo "exit=$?"
# Expect: JSON with "permissionDecision":"ask", exit=0

# Missing context -> fail safe, asks
rm -f /tmp/gxtest/.gainwix/deploy-context.json
printf '{"cwd":"/tmp/gxtest","tool_name":"mcp__cloud-run__deploy-local-folder","tool_input":{}}' \
  | node hooks/gate-production.js; echo "exit=$?"
# Expect: JSON with "permissionDecision":"ask", exit=0
```

End to end: in a sandbox app repo, run `/gx-gcp-deploy`, let the workmate
classify a production target, and confirm Claude Code shows you a permission
prompt at the deploy step that you must approve by hand — and that switching to
Auto mode does **not** remove that prompt.

## 6. End-to-end demo (the definition of done)

From a **separate** application repository:

1. `/plugin marketplace add /path/to/gainwix-ai-experience`
2. `/plugin install gainwix@gainwix-workmates`
3. `/gx-init` — confirm it detects the stack and validates GCP.
4. `/gx-sim` — confirm it prints a plan and applies nothing.
5. `/gx-gcp-deploy` — answer at most a couple of questions, approve the gates,
   and get a live Cloud Run URL plus a `created-deployment.md` in that repo.

Use a sandbox GCP project for the real deploy.
