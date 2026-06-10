---
name: gx-debug
description: (Coming soon) Diagnose GainWix and GCP connectivity issues.
disable-model-invocation: true
---

**`/gx-debug` is not implemented yet in this build.**

Intended purpose: diagnostics — check that the Cloud Run MCP is reachable, that GCP credentials/project/region are valid, that the workmate's gates are wired correctly, and surface anything misconfigured. The "why isn't it working" command.

For now, tell the developer it's coming soon. As a manual stopgap they can re-run `/gx-init`, which validates GCP access. Take no other action.
