# qa/runner — the GainWix QA runner

The program `/gx-qa` uses to actually execute your QA. It reads [`../QA.md`](../QA.md),
drives a real Chrome (Playwright) through each workflow's steps, screenshots every
step, and writes a self-contained HTML report + JSON sidecar + run log.

It is **stack-agnostic** — it knows nothing about your framework. You give it a
URL; it runs the steps `QA.md` declares. It is runnable by a human or CI with no
Claude involvement.

> Scaffolded by `/gx-init`. You normally invoke it via `/gx-qa` (which boots your
> stack first), but you can run it directly too — see below.

## ⚠️ What you need before it can run

`/gx-qa` (or you) must have **all** of these in place — the runner does **not** set
them up:

1. **Node ≥ 18** (for built-in `fetch`).
2. **The runner's dependencies + a browser** — one-time per machine:
   ```bash
   cd qa/runner
   npm install                      # installs Playwright (declared here, not in your app)
   npx playwright install chromium  # downloads the browser (needs network)
   ```
3. **Your stack running** at the URL(s) you pass — frontend at `--base`, and (only
   if you have `Mode: api` workflows) the API at `--api-base`. Boot it against an
   **isolated, seeded test database**, never real/dev data — document how in
   [`../QA.md`](../QA.md)'s *Environment / setup* section.
4. **At least one workflow** under `## QA Workflows` in `../QA.md` (else it aborts).
5. **Env for any `${VAR}`** your workflows reference (e.g. a throwaway test
   password) — exported before the run.

## Run it

```bash
# from the repo root, with your stack already up:
node qa/runner/run.mjs --base http://localhost:5173 [--api-base http://localhost:3000]
```

| Flag / env | Default | Purpose |
| :-- | :-- | :-- |
| `--base <url>` | (required) | Frontend URL your stack is serving. |
| `--api-base <url>` / `QA_API_BASE` | — | API origin for `Mode: api` workflows. |
| `--timeout <ms>` / `QA_TIMEOUT` | `35000` | Per-step timeout. |
| `--concurrency <n>` / `QA_CONCURRENCY` | `2` | Parallel-group pool size. |
| `--qa-file <path>` | `qa/QA.md` | The suite to run. |
| `--out <dir>` | `qa` | Where reports are written. |
| `QA_API_TOKEN` | — | Bearer token for api workflows … |
| `QA_TOKEN_MINT_CMD` | — | … or a command that prints one (run if the token is unset). Never logged. |

Exit code: **0** if every workflow passed, **1** if any failed (or none found).

## Step vocabulary (what you write in `QA.md`)

**Browser** (`Mode: serial` or `parallel`):

| Step | Meaning |
| :-- | :-- |
| `goto <path|url>` | Navigate (path is appended to `--base`). |
| `click <selector>` | Click the first match. |
| `fill <selector> "<value>"` | Type into a field (value quoted; supports `${VAR}`). |
| `assertVisible <selector>` | Wait for the element to be visible. |
| `assertText <selector> "<text>"` | Assert the element's text contains `<text>`. |
| `assertUrl <substring>` | Assert the current URL contains `<substring>`. |
| `wait <ms>` | Explicit pause. |
| `screenshot [label]` | Capture the viewport. |

**API** (`Mode: api`, no browser):

| Step | Meaning |
| :-- | :-- |
| `get <path>` / `post <path> "<json>"` | Call the API (Bearer-authed if a token is set). |
| `assertStatus <code>` | Assert the last response's HTTP status. |
| `assertJson <dot.path> "<expected>"` | Assert a field of the last JSON response. |
| `snapshot [label]` | Record the last response body in the report. |

## `${VAR}` substitution (secret-safe)

In any step value, `${RUN_TS}` becomes the run timestamp (handy for unique signup
emails: `qa-${RUN_TS}@example.com`) and `${SOME_ENV}` becomes `process.env.SOME_ENV`.
Resolved values are passed **only** to the browser/fetch — never written to the
report, run log, or stdout. Reference secrets as `${VAR}`, never inline.

## What it does NOT do

It does **not** boot your app, reset your DB, or seed data — that's `/gx-qa`'s job
(per `QA.md`'s setup section). The runner assumes your servers are already up.
