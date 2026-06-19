#!/usr/bin/env node
/**
 * GainWix — GATE 2: production promotion gate.
 *
 * This is the conscience of the GainWix deploy command. It runs as a PreToolUse
 * hook and enforces — deterministically, independent of the agent and the trust
 * mode — that a deploy classified as PRODUCTION cannot proceed without an
 * explicit, interactive human approval. It does this by returning
 * permissionDecision "ask", which forces Claude Code to surface a permission
 * prompt. Auto mode CANNOT satisfy an "ask" on its own, so Gate 2 holds even in
 * Auto mode. This is a guarantee, not a polite suggestion.
 *
 * It covers EVERY deploy/provision path:
 *   - Cloud Run   — the MCP deploy tools (mcp__cloud-run__deploy*).
 *   - Static site — `gcloud storage` / `gsutil` publish to a bucket (upload,
 *                   make-public, set website config), via Bash.
 *   - Infra       — `terraform apply|destroy`, `kubectl` mutations, and
 *                   `gcloud compute|sql|container|run` provisioning/deploys
 *                   (GKE, Compute Engine VM, Cloud SQL), via Bash.
 * Read-only commands (terraform plan, kubectl get, gcloud … list/describe, etc.)
 * and any other Bash are ignored — the hook defers instantly so it never
 * interferes with normal work.
 *
 * Classification source of truth: <cwd>/.gainwix/deploy-context.json, written by
 * the workmate during planning. Fail-safe: if that file is missing, unreadable,
 * malformed, or the deploy inputs look production-like, treat it as production.
 */

const fs = require("fs");
const path = require("path");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function decision(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision,
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

// Defer: no decision — normal permission flow (and trust mode) decides.
function defer() {
  process.exit(0);
}

// Does this Bash command deploy/provision GCP infra we must gate? Returns a
// short human label (for the prompt message) or null to defer. Only WRITE/
// provision verbs match — read-only commands (terraform plan, kubectl get,
// gcloud … list/describe) deliberately return null so normal work is untouched.
function classifyBashDeploy(command) {
  if (typeof command !== "string") return null;
  const c = command;

  // Static-site publish to a Cloud Storage bucket. We gate the EXPOSURE moments
  // — uploading content, making it public, or deleting the bucket — not a bare
  // `buckets create` (an empty private bucket isn't live, and the Terraform
  // state bucket `gs://<project>-tfstate` is created the same way; the actual
  // go-live, the upload + make-public below, is already gated).
  if (
    /\bgcloud\s+storage\s+(rsync|cp)\b[\s\S]*gs:\/\//.test(c) ||
    /\bgcloud\s+storage\s+buckets\s+(add-iam-policy-binding|delete)\b/.test(c) ||
    /\bgcloud\s+storage\s+buckets\s+update\b[\s\S]*--web-/.test(c) ||
    /\bgsutil\b[\s\S]*\b(rsync|cp)\b[\s\S]*gs:\/\//.test(c) ||
    /\bgsutil\s+(iam|web|acl|defacl)\b/.test(c)
  ) {
    return "static-site bucket";
  }

  // Terraform — only apply/destroy change the world (plan/init/validate don't)
  if (/\bterraform\s+(apply|destroy)\b/.test(c)) {
    return "Terraform-managed infrastructure";
  }

  // kubectl mutations (GKE workloads) — not get/describe/logs
  if (/\bkubectl\s+(apply|delete|replace|patch|create|scale|rollout|set)\b/.test(c)) {
    return "GKE workload";
  }

  // gcloud provisioning/deploys for compute / sql / container / run
  if (/\bgcloud\s+sql\b[\s\S]*?\b(create|delete|patch|restart|clone|import)\b/.test(c)) {
    return "Cloud SQL";
  }
  if (/\bgcloud\s+container\b[\s\S]*?\b(create|delete|update|resize|upgrade)\b/.test(c)) {
    return "GKE cluster";
  }
  if (/\bgcloud\s+compute\b[\s\S]*?\b(create|delete|update|reset|start|stop|resize)\b/.test(c)) {
    return "Compute Engine VM";
  }
  if (/\bgcloud\s+run\s+(deploy\b|services\s+(update|update-traffic|delete|replace))/.test(c)) {
    return "Cloud Run";
  }

  return null;
}

function looksProductionFromInput(toolInput) {
  try {
    return /prod(uction)?/i.test(JSON.stringify(toolInput || {}));
  } catch {
    return false;
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}");
} catch {
  payload = {};
}

const toolName = payload.tool_name || "";
const toolInput = payload.tool_input || {};

// Decide whether this call is a deploy/provision we must gate.
const isCloudRunDeploy = /^mcp__cloud-run__deploy/.test(toolName);
const bashKind = toolName === "Bash" ? classifyBashDeploy(toolInput.command) : null;

if (!isCloudRunDeploy && !bashKind) {
  // Not a deploy/provision — get out of the way immediately.
  defer();
}

const kind = isCloudRunDeploy ? "Cloud Run" : bashKind;
const cwd = payload.cwd || process.cwd();
const contextPath = path.join(cwd, ".gainwix", "deploy-context.json");

let target = null;
let ctx = null;
try {
  ctx = JSON.parse(fs.readFileSync(contextPath, "utf8"));
  if (ctx && typeof ctx.target === "string") {
    target = ctx.target.trim().toLowerCase();
  }
} catch {
  // missing / unreadable / malformed -> fail safe below
}

const svc = ctx && ctx.service ? ` "${ctx.service}"` : "";

if (target === "production") {
  decision(
    "ask",
    `GATE 2 (GainWix): promoting${svc} to PRODUCTION (${kind}). Explicit human approval is required and cannot be auto-approved. Reason on file: ${
      (ctx && ctx.reason) || "n/a"
    }`
  );
}

if (target !== "non-production") {
  decision(
    "ask",
    `GATE 2 (GainWix): no trustworthy non-production classification found (.gainwix/deploy-context.json missing or invalid) for this ${kind} deploy. Treating it as production and requiring explicit human approval.`
  );
}

if (looksProductionFromInput(toolInput)) {
  decision(
    "ask",
    `GATE 2 (GainWix): this ${kind} deploy looks production-like (matched /prod/ in its inputs). Requiring explicit human approval regardless of the recorded classification.`
  );
}

// Classified non-production and nothing looks production -> defer to normal flow.
defer();
