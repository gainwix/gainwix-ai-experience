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
 * It covers BOTH deploy paths:
 *   - Cloud Run  — the MCP deploy tools (mcp__cloud-run__deploy*).
 *   - Static site — `gcloud storage` / `gsutil` commands that publish to a bucket
 *                   (upload, make-public, or set website config), run via Bash.
 * Any other tool call (incl. ordinary Bash) is ignored — the hook defers
 * instantly so it never interferes with normal work.
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

// Is this Bash command a static-site publish to a Cloud Storage bucket?
// (upload to gs://, make a bucket public, or set its website config)
function isBucketPublish(command) {
  if (typeof command !== "string") return false;
  const c = command;
  return (
    /\bgcloud\s+storage\s+(rsync|cp)\b[\s\S]*gs:\/\//.test(c) ||
    /\bgcloud\s+storage\s+buckets\s+add-iam-policy-binding\b/.test(c) ||
    /\bgcloud\s+storage\s+buckets\s+update\b[\s\S]*--web-/.test(c) ||
    /\bgsutil\b[\s\S]*\b(rsync|cp)\b[\s\S]*gs:\/\//.test(c) ||
    /\bgsutil\s+(iam|web)\b/.test(c)
  );
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

// Decide whether this call is a deploy we must gate.
const isCloudRunDeploy = /^mcp__cloud-run__deploy/.test(toolName);
const isStaticPublish = toolName === "Bash" && isBucketPublish(toolInput.command);

if (!isCloudRunDeploy && !isStaticPublish) {
  // Not a deploy — get out of the way immediately.
  defer();
}

const kind = isCloudRunDeploy ? "Cloud Run" : "static-site bucket";
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
