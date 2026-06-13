---
name: gx-debug
description: (Coming soon) Diagnose GainWix and GCP connectivity issues.
disable-model-invocation: true
---

**`/gx-debug` is not implemented yet in this build.**

Intended purpose: diagnostics — check that the Cloud Run MCP is reachable, that GCP credentials/project/region are valid, that the workmate's gates are wired correctly, and surface anything misconfigured. The "why isn't it working" command.

For now, tell the developer it's coming soon. As a manual stopgap they can run `/mcp` to check the Cloud Run MCP is connected, and `/gx-sim` (or `/gx-gcp-deploy`), which resolves and validates GCP access as its first cloud step. (`/gx-init` only scaffolds the repo — it does not touch GCP.) Take no other action.
