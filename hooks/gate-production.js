#!/usr/bin/env node
/**
 * GainWix — GATE 2: production promotion gate.
 *
 * This is the conscience of the GainWix deploy command. It runs as a PreToolUse
 * hook on every Cloud Run MCP deploy tool call (mcp__cloud-run__deploy*).
 *
 * It enforces — deterministically, independent of the agent and independent of
 * the trust mode — that a deploy classified as PRODUCTION cannot proceed without
 * an explicit, interactive human approval. It does this by returning
 * permissionDecision "ask", which forces Claude Code to surface a permission
 * prompt to the human. Auto mode CANNOT satisfy an "ask" on its own, so Gate 2
 * holds even in Auto mode. This is a guarantee, not a polite suggestion.
 *
 * Classification source of truth: <cwd>/.gainwix/deploy-context.json, written by
 * the workmate during planning. Fail-safe posture: if that file is missing,
 * unreadable, malformed, or the deploy's own inputs look production-like, we
 * treat the deploy as production and gate it.
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

function defer() {
  // No decision: let the normal permission flow (and trust mode) decide.
  process.exit(0);
}

function looksProductionFromInput(toolInput) {
  try {
    const blob = JSON.stringify(toolInput || {}).toLowerCase();
    return /prod(uction)?/.test(blob);
  } catch {
    return false;
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}");
} catch {
  // Can't even parse the event — fail safe and gate.
  decision(
    "ask",
    "GATE 2 (GainWix): could not read the deploy event, so production safety is enforced. Approve only if you intend to deploy."
  );
}

const cwd = payload.cwd || process.cwd();
const toolInput = payload.tool_input || {};
const contextPath = path.join(cwd, ".gainwix", "deploy-context.json");

let target = null;
let ctx = null;
try {
  ctx = JSON.parse(fs.readFileSync(contextPath, "utf8"));
  if (ctx && typeof ctx.target === "string") {
    target = ctx.target.trim().toLowerCase();
  }
} catch {
  // missing / unreadable / malformed -> handled below as fail-safe
}

const svc = ctx && ctx.service ? ` service "${ctx.service}"` : "";

// Gate when: explicitly production, OR no honest classification was written,
// OR the deploy inputs themselves look production-like.
if (target === "production") {
  decision(
    "ask",
    `GATE 2 (GainWix): promoting${svc} to PRODUCTION. Explicit human approval is required and cannot be auto-approved. Reason on file: ${
      (ctx && ctx.reason) || "n/a"
    }`
  );
}

if (target !== "non-production") {
  decision(
    "ask",
    "GATE 2 (GainWix): no trustworthy non-production classification found (.gainwix/deploy-context.json missing or invalid). Treating this deploy as production and requiring explicit human approval."
  );
}

if (looksProductionFromInput(toolInput)) {
  decision(
    "ask",
    "GATE 2 (GainWix): the deploy target looks production-like (matched /prod/ in its inputs). Requiring explicit human approval regardless of the recorded classification."
  );
}

// Classified non-production and nothing looks production -> defer to normal flow.
// In Suggest mode the user still confirms; in Auto mode this may auto-approve.
defer();
