# QA

The QA backlog + operating contract for `/gx-qa` — the QA-side analog of
`BACKLOG.md`. The **read-first preamble** below is the contract every `/gx-qa`
run follows; the **`## QA Workflows`** section at the bottom is the work list the
runner chomps through, top-down.

### QA autonomy preamble (read first)

**Purpose.** `/gx-qa` runs comprehensive **end-to-end** QA: complete user
workflows driven through a real browser (and/or the API) so each exercises the
frontend AND backend together — the integration that per-tier unit suites cannot
reach. Run the full suite **without prompting for approval**: boot → drive →
screenshot → report → triage.

**How `/gx-qa` consumes this file.** This is a **persistent regression suite**:
every `/gx-qa` run executes **ALL** the workflows under `## QA Workflows`, in
document order, and **never removes them** (unlike `BACKLOG.md`, whose items
`/gx-go` dequeues). Each workflow declares a **`Mode:`** of `parallel` or
`serial` (default `serial`): the runner executes the parallel group first
(concurrently, each in its own isolated browser context), then the serial group
one-at-a-time in document order.

**Environment / setup.** Document here how to boot your stack against an
**isolated, freshly seeded** test database (never a developer's real data), and
which ports the frontend/back end listen on. The runner under `qa/runner/`
automates this.

> **Runner required.** `/gx-qa` drives a Playwright/chromium runner expected at
> `qa/runner/` (`run.mjs` + report generator). `/gx-init` scaffolds this `qa/QA.md`
> file but **not** the runner — add it before `/gx-qa` can do a live run. Until
> then `/gx-qa` will report the missing runner and stop.

**Outputs** (one set per run, committed except the screenshots):

- `qa/RUN-REPORT-<ts>.html` — self-contained report (summary + per-workflow
  sections with linked screenshots and located errors).
- `qa/RUN-REPORT-<ts>.json` — machine-readable sidecar `/gx-qbugs` reads to file
  bug issues.
- `qa/RUN-REPORT-<ts>/` — step screenshots (local-only, **gitignored**).
- `qa/RUN-LOG.md` — newest-first index of every run (the QA analog of `CHANGELOG.md`).

A `/gx-qa` run is **operational**: it commits the small `qa/` artifacts to the
trunk directly — it does not run `/gx-go` or write a `changes/*.md`.

----------------------------------------------------------------

## QA Workflows

<!--
Add one workflow per `### ` heading. Template:

### My first journey
- **Route:** /
- **Mode:** serial
- **Surfaces:** frontend, backend
- **Steps:**
  - goto /
  - assertVisible <selector>
  - click <selector>
  - assertText <selector> "expected"
  - screenshot

`/gx-qa` aborts cleanly while this section has no `### ` workflow entries.
-->
