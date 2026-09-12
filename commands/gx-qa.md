---
description: End-to-end QA — boot your stack (frontend + backend) against an isolated, freshly seeded test database (per qa/QA.md's Environment/setup section), run every workflow in qa/QA.md through Playwright/chromium, capture per-step screenshots, emit a self-contained paginated qa/RUN-REPORT-<ts>.html with linked screenshots + highlighted located errors, prepend qa/RUN-LOG.md, then triage failures (root-cause WHERE — frontend vs backend). OPERATIONAL: commits the qa/ artifacts to develop; NOT a /gx-go change (no changes/*.md, no CHANGELOG entry). Aborts cleanly when qa/QA.md has no workflows.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-qa — end-to-end QA run (browser + API), reported with screenshots

`/gx-qa` drives complete user journeys across BOTH tiers of your stack — the
frontend (web UI) and the backend (API / system of record) — through a real
browser (Playwright / chromium), captures a screenshot at every meaningful step,
and emits a shareable, self-contained HTML report plus a newest-first run log. It
is the cross-tier complement to the per-tier unit/integration suites: it catches
integration breaks (auth/cookie/CSRF/proxy, serializer or contract drift, route
gaps, broken pages) that isolated tests miss.

A `/gx-qa` **run is OPERATIONAL, like `/gx-sweep`** — it commits the small `qa/`
artifacts (the new `RUN-REPORT-<ts>.html`, its machine-readable
`RUN-REPORT-<ts>.json` sidecar, and the updated `RUN-LOG.md`) directly to
`develop`. The per-run **`RUN-REPORT-<ts>/` screenshot folder is NOT committed**
(it is gitignored — a full run is ~30 MB of PNGs; screenshots are LOCAL run
evidence the HTML links relatively, so they render locally right after a run, not
on GitHub). It does **NOT** run the `/gx-go`
workflow, does **NOT** write a `.gainwix/<component>/changes/*.md` record, and does **NOT** add a
`.gainwix/<component>/CHANGELOG.md` entry. (Building or modifying the `/gx-qa` machinery — the runner, the
report generator, this recipe — IS a normal `/gx-go` code change; only *running* a
QA pass is operational.)

## `qa/QA.md` is a PERSISTENT REGRESSION SUITE (read first)

Unlike the backlog (`.gainwix/<component>/backlog.html`) — whose top item `/gx-go` **dequeues** as it ships — `qa/QA.md`
is a **persistent regression suite**. Every `/gx-qa` invocation runs **ALL** the
workflows under `## QA Workflows`, in document order, and **NEVER removes**
them: `/gx-qa` only ever *reads* `qa/QA.md`, never edits it. The same suite is
re-run in full each time, so a regression in any previously-green workflow shows
up on the next run. New workflows are ADDED to the suite (by a separate `/gx-go`
change to `qa/QA.md`); they are not consumed.

### Per-workflow `Mode: parallel | serial`

Each workflow declares a **`Mode:`** of `parallel` or `serial` (**default
`serial`** when omitted/unrecognised — the safe default, since a workflow is
assumed to mutate or depend on shared backend state unless declared otherwise).
The runner schedules them in two groups:

- **`parallel` group runs FIRST, concurrently** — each workflow in its **own
  isolated browser context** (separate cookies/session), with a bounded pool
  (`QA_CONCURRENCY`, default 2; not unbounded `Promise.all`). A `parallel`
  workflow MUST be self-contained: read-only, or mutating only data disjoint
  from every other parallel workflow using its own identity/seed data.
- **`serial` group runs SECOND, one-at-a-time, in document order** — these may
  depend on prior serial workflows' side effects / shared backend state.

Either way, `results.workflows` (and the report) stay in **document order**, and
the report shows a **mode badge** per workflow plus an "N parallel · M serial"
note in the summary. The runner logs which group/mode each workflow ran in.

## Layered design (read first)

- **The runner** (`qa/runner/`, standalone Node ESM + Playwright) is the
  deterministic core — it parses `qa/QA.md`, drives chromium through each
  workflow, screenshots, generates the report, and updates `RUN-LOG.md`. It is
  runnable by a human or CI with no Claude involvement.
- **This command** is the Claude-facing wrapper: it boots your stack against an
  isolated, seeded test database (per `qa/QA.md`'s Environment/setup section),
  invokes the runner, then **triages** the results — root-causing each failure and
  stating WHERE it lives (workflow step / frontend route / component / API
  endpoint + HTTP status, frontend vs backend) — and prints the roll-up. The
  runner already records a located error in the report; Claude's value-add is the
  human explanation + next step.

## Abort cleanly when there are no workflows

Read `qa/QA.md`. If its `## QA Workflows` section contains **no** `### ` workflow
entries (only the preamble / a commented template), print **"qa/QA.md has no QA
workflows — nothing to run."** and STOP. Produce no report, no screenshots, no
`RUN-LOG.md` change, and no commit. (The runner enforces this too: it exits
non-zero with that message when the parse yields zero workflows.)

## Step 1 — Prerequisites (one-time per machine, then reuse)

`/gx-init` scaffolds the runner at `qa/runner/` — self-contained (it declares its
own Playwright dep). Install it + the chromium browser once:

```bash
cd qa/runner
npm install                         # installs Playwright (node_modules is gitignored)
npx playwright install chromium     # downloads the browser (needs network)
```

If chromium cannot download (offline/blocked), `/gx-qa` cannot do a live browser run
— say so and stop; do not fake screenshots.

## Step 2 — Boot the stack on a freshly RESET, isolated, seeded test DB

**Never run QA against real or dev data.** Boot your stack against a **dedicated,
isolated test database** seeded with **throwaway** credentials — exactly as
documented in your repo's **`qa/QA.md` → "Environment / setup"** section. That
section is where the per-project boot lives (the reset/seed commands, the ports,
any tokens); this recipe stays stack-agnostic and just *follows* it.

**RESET the test database every run — drop + recreate + reseed, not just a
migrate/prepare.** A QA suite typically includes **mutating** workflows (an
approval that advances a record's status, an onboarding that's one-way, etc.).
Those mutations don't undo themselves, so an idempotent migrate/seed would leave
records advanced after the first run and the mutating workflows would no longer
find their actionable seed state (e.g. an item that should still be "pending review"
would already be "published"). Dropping + recreating + reseeding an **isolated**
test DB each run returns all seeded mid-lifecycle state to its initial state, so
every workflow is **deterministic and repeatable**. Keep the reset confined to the
throwaway test DB — it must **never** touch dev/prod data.

Following your `qa/QA.md` setup section, in order:

1. **Reset + seed** the isolated test DB (drop → recreate → load schema → seed)
   with throwaway placeholder secrets.
2. **Boot the backend** (API) on its port, pointed at the test DB (background).
3. **Boot the frontend** on its port (background). If the frontend proxies the API,
   note which paths it forwards — api-mode workflows that bypass the proxy hit the
   API origin directly via `QA_API_BASE` (Step 3).

**(api-mode workflows only)** If any workflow is `Mode: api`, resolve whatever its
Bearer/API surface needs against the **same** isolated test DB — typically mint an
API token for a seeded user (and read any required record id), then `export` them
so the run is deterministic and the token is fetched once. The runner can also mint
a token itself via `QA_TOKEN_MINT_CMD` (Step 3). Any such token is a **SECRET** —
keep it in the shell env only; never echo it, write it to a report, or commit it.

Use **throwaway placeholder** secrets only (a dummy `qa-throwaway-pw`-style value)
— never real credentials, and never write cleartext real secrets into the repo or
a report (honor the no-cleartext-secrets rule). Wait until both ports answer (poll
the frontend URL and the backend health endpoint) before running.

## Step 3 — Run the runner

From the repo root, with Playwright resolvable via `NODE_PATH` (optionally cap the
parallel pool with `QA_CONCURRENCY`, or widen the per-step timeout with
`QA_TIMEOUT`). **Export the same secrets you seeded with**, so the runner's
`${VAR}` substitution (below) resolves to the seeded credentials:

```bash
QA_CONCURRENCY=2 \
  MY_APP_USER_PASSWORD=<throwaway-qa-pw> \
  MY_APP_ADMIN_EMAIL=qa@example.com \
  QA_API_BASE=<backend-origin, only if api-mode workflows exist> \
  QA_API_TOKEN="$QA_API_TOKEN" \
  node qa/runner/run.mjs --base <frontend-url>
```

The runner is self-contained (it resolves Playwright from `qa/runner/node_modules`),
so no `NODE_PATH` is needed. Replace the `MY_APP_*` names with whatever `${VAR}`
tokens your `qa/QA.md` workflows reference (see the substitution section below), and
the `<…>` placeholders with your frontend URL and (if needed) backend origin.

**API-mode workflows (`Mode: api`).** These run with NO browser — the runner drives
your API surface with `fetch` and records JSON snapshots (no screenshots). They
authenticate with a Bearer token from `QA_API_TOKEN` (exported in Step 2) — or, if
unset, the runner mints one via the command in **`QA_TOKEN_MINT_CMD`** (set this to
your project's token-minting command; `QA_LEARNER_EMAIL` names the seeded user when
that command reads it). The token rides only in the `Authorization` header and is
NEVER logged. If your frontend proxies only some paths (not the API), api workflows
hit the **API origin directly** via `QA_API_BASE` (or `--api-base`), bypassing the
proxy — a Bearer API needs no cookie/CSRF/same-origin handling.

**Per-step timeout (`QA_TIMEOUT`, default `35000`ms):** each Playwright step
(`waitFor` / `click` / `fill` / `goto` / `networkidle`) is bounded by this
timeout (override via `QA_TIMEOUT=<ms>` or `--timeout <ms>`). The default is a
roomy 35s because a dev stack (dev servers + a test-mode backend) can slow down
measurably over a long (30+ workflow) run, so the heaviest serial steps late in
the run — typically a login/queue click — would intermittently exceed a tighter
budget and false-fail even when run `serial` (a dev-stack-degradation artifact,
not parallel contention). Raise it further against a slow CI box; lower it against
a fast production-style build.

### `${VAR}` / `${RUN_TS}` substitution in step args (secret-safe)

So that `qa/QA.md` never hardcodes credentials, the runner resolves `${…}` tokens
inside a step ARG (a `fill` value, a `goto` path, an `assertText` text) **at
step-execution time**:

- `${RUN_TS}` → the run's timestamp (e.g. `qa-signup-${RUN_TS}@example.com` mints a
  unique signup email each run).
- `${ANY_ENV}` → `process.env.ANY_ENV` (e.g. `${MY_APP_USER_PASSWORD}`,
  `${MY_APP_ADMIN_EMAIL}` — whatever names your workflows use). An unset var
  resolves to `""` plus a one-line stderr warning that names **only the var**
  (never a value).

**Secret safety (do not regress):** the resolved value is passed **only** to
Playwright's `fill`/`goto`. It is **never** written to the report, `RUN-LOG.md`, a
screenshot filename, or stdout/stderr — a `fill` step's report label shows only its
**selector** (not the value), and password inputs render masked in screenshots.
That is why the workflow files reference `${…}` env tokens instead of plaintext
secrets, and why you export those env vars (matching the seeded creds) before this
step.

The runner splits the suite into the **parallel** and **serial** groups, runs the
**parallel group first** (concurrently, bounded by `QA_CONCURRENCY`, default 2,
each workflow in its own isolated browser context) and the **serial group second**
(one-at-a-time, in document order). For each workflow it:
- navigates to the workflow's `Route`, executes its `Steps`
  (`assertVisible` / `assertText` / `click` / `fill` / `goto` / `screenshot`),
- screenshots each meaningful step into
  `qa/RUN-REPORT-<ts>/<workflow-slug>-NN-<label>.png` (viewport **1440×900**, PNG),
- intercepts network responses so a UI failure right after a 4xx/5xx is attributed
  to that **endpoint + HTTP status**,
- re-writes `qa/RUN-REPORT-<ts>.html` + its `qa/RUN-REPORT-<ts>.json` sidecar and
  prepends `qa/RUN-LOG.md` **after every workflow** (append-as-you-go — an
  interrupted run still leaves a usable report + a current JSON sidecar),
- exits `0` if every workflow passed, `1` if any failed (or none found).

`results.workflows` stays in **document order** regardless of group, and the
report shows a **mode badge** per workflow + an "N parallel · M serial" summary
note.

Timestamp convention: `YYYY-MM-DD-HH-MM-SS` — the report file
(`qa/RUN-REPORT-<ts>.html`) and its screenshot folder (`qa/RUN-REPORT-<ts>/`)
share one base name.

## Step 4 — Triage (Claude's role)

Open the report / read the runner's stderr. For each **failed** workflow:
- **Root-cause it** and state WHERE: which workflow step, which frontend route, which
  component, and — when a request failed — which API endpoint + HTTP status.
- **Attribute frontend vs backend.** A 4xx/5xx on an API call → backend
  (serializer/route/auth/CSRF). A page that mounts but a selector never appears,
  with no failing request → frontend (route/component/render). A redirect to the
  login route on an authenticated page → session/cookie/guard wiring.
- The runner already embeds a located error block in the report; add the human
  explanation + the likely fix in your roll-up.

## Step 5 — Commit the artifacts (operational), then report

This is a `/gx-sweep`-style operational commit — NOT a `/gx-go` change:

```bash
# Screenshots (qa/RUN-REPORT-*/) are gitignored (local-only) — commit only the
# small HTML report + JSON sidecar + the run log.
git add qa/RUN-REPORT-*.html qa/RUN-REPORT-*.json qa/RUN-LOG.md
git commit -m "qa: run report <ts> (<passed>/<total> passed)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin develop
```

(Commit only when there is a real report to commit; if `/gx-qa` aborted on an empty
`qa/QA.md`, there is nothing to commit.) Do **not** create a `.gainwix/<component>/changes/*.md` and do
**not** touch `.gainwix/<component>/CHANGELOG.md`.

## Step 5b — Advance the issue kanban (`WIP` → `DONE`)

**Operational, like the qa-artifact commit** — no `.gainwix/<component>/changes/*.md`, no `/gx-go`. This
closes the loop on the issue kanban (`queued`→`WIP`→`DONE`): a tracked kanban issue
sits at `WIP` (moved there by `/gx-next`) while `/gx-go` ships its work as SUBORDINATE
issues; once all those subordinates are closed AND QA is green, the kanban issue is
DONE.

**ONLY when this run is GREEN (0 failures).** If the run has ANY failures, do
**not** sweep — skip this step entirely (leave every `WIP` issue at `WIP`). When
green:

```bash
# For each OPEN issue labeled WIP, check its "## Sub-issues" task-list.
for N in $(gh issue list --state open --label WIP --json number --jq '.[].number'); do
  body="$(gh issue view "$N" --json body -q .body)"
  # Collect the "#<sub>" numbers from the "- [ ] #<n>" / "- [x] #<n>" task-list
  # lines only (the "## Sub-issues (opened by /gx-go)" entries), not any prose mention.
  subs=$(printf '%s\n' "$body" | grep -E '^- \[[ xX]\] *#[0-9]+' \
           | grep -oE '#[0-9]+' | tr -d '#' | sort -u)
  [ -z "$subs" ] && continue          # no subordinates yet → not ready for DONE
  all_closed=1
  for s in $subs; do
    st="$(gh issue view "$s" --json state -q .state)"   # OPEN | CLOSED
    [ "$st" = "CLOSED" ] || { all_closed=0; break; }
  done
  if [ "$all_closed" = 1 ]; then
    gh issue edit "$N" --remove-label WIP --add-label DONE && \
      gh issue close "$N" --reason completed
  fi
done
```

- Advance `#<N>` only when it has **≥1** subordinate AND **every** subordinate is
  `CLOSED`. (A `WIP` issue with no subordinates yet — `/gx-go` hasn't shipped against
  it — is left at `WIP`.)
- Best-effort: if a `gh` call fails, note it and continue. **Report which issues
  advanced** to `DONE` (and which `WIP` issues were left, with why — failures in
  the run, or subordinates still open).
- This is a **remote GitHub op** + clearly OPERATIONAL (like `/gx-qbugs` labeling): no
  `.gainwix/<component>/changes/*.md`, no `.gainwix/<component>/CHANGELOG.md`, no `/gx-go` workflow.

## Step 6 — Tear down

Stop the background servers you started (the frontend and the backend). The
isolated test database can be left for the next run (the reset re-seeds it from
scratch) or dropped — whichever your `qa/QA.md` setup section specifies.

## Step 7 — Print the roll-up

Print: workflows run, pass/fail counts, the report path
(`qa/RUN-REPORT-<ts>.html`) + its `qa/RUN-REPORT-<ts>.json` sidecar +
`RUN-LOG.md` link, and — for any failure — the located root cause (step / route /
component / endpoint+status, frontend vs backend). Mention the run was committed
to develop as an operational `/gx-qa` run (no `.gainwix/<component>/changes/*.md`, no CHANGELOG entry).
On a **green** run, also report the kanban sweep from Step 5b: which `WIP` issues
advanced to `DONE` (all subordinates closed) and which stayed `WIP` (subordinates
still open). If there were failures, suggest running **`/gx-qbugs`** to file them as
`bug` Issues + ACTION-ITEMS fix tasks (it reads the JSON sidecar).

## Artifact conventions (committed)

- `qa/RUN-REPORT-<ts>.html` — self-contained (inline CSS+JS, no external/CDN
  deps): a top summary (start / end / elapsed + an "N parallel · M serial" note +
  the workflow list with pass/fail **and** parallel/serial mode badges), then a
  per-workflow section (mode badge in the header, what was tested, issues found,
  linked step screenshots), each error highlighted with its screenshot + a located
  WHERE string. **Client-side pagination** kicks in when workflows **> 2**.
- `qa/RUN-REPORT-<ts>.json` — a machine-readable sidecar carrying the structured
  `results` (run `ts` / timing / `baseUrl` / `screenshotDir` + each workflow's
  `name`/`slug`/`route`/`surfaces`/`mode`/`status`/`tested`/`steps` and, for a
  failure, `error{message, where{step,route,component,endpoint,httpStatus},
  screenshot}`). It is the STABLE failure source the **`/gx-qbugs`** command reads to
  file bug Issues + ACTION-ITEMS fix tasks (no HTML scraping). Secret-safe: built
  from the same objects the HTML uses (only `${VAR}` step labels + masked data).
  Written alongside the HTML after every workflow (append-as-you-go), so an
  interrupted run still leaves a current sidecar.
- `qa/RUN-REPORT-<ts>/` — the step screenshots referenced relatively by the HTML.
  **NOT committed — gitignored** (a full run is ~30 MB of PNGs). They are LOCAL
  run evidence: the committed HTML links them relatively, so they render locally
  right after a run (not on GitHub). The committed HTML summary + located errors +
  the JSON sidecar preserve the durable results.
- `qa/RUN-LOG.md` — newest-first index linking each report (the QA analog of
  `.gainwix/<component>/CHANGELOG.md`). **Note:** this file was renamed from `RUNLOG.md` → `RUN-LOG.md`;
  the runner writes/prepends `qa/RUN-LOG.md` (older run reports/CHANGELOG history may
  still reference the former `RUNLOG.md` name).
- `.gitignore` COMMITS the small artifacts (HTML report + `.json` sidecar +
  `RUN-LOG.md`) and IGNORES the `qa/RUN-REPORT-*/` screenshot folders + any
  `qa/runner/node_modules`.

## Notes

- `/gx-qa` is **operational** — it commits `qa/` artifacts but is not a `/gx-go` change.
  Modifying the `/gx-qa` machinery itself IS a `/gx-go` change.
- **Issue kanban sweep (Step 5b).** On a GREEN run only, `/gx-qa` advances each OPEN
  `WIP` issue whose subordinates are ALL closed to `DONE` (label + close) — the
  closing end of the `queued`→`WIP`→`DONE` kanban (`/gx-issue-pick` removes `queued`;
  `/gx-next` adds `WIP`; `/gx-qa`/`/gx-qbugs` add `DONE` + close). A red run never sweeps.
- It pairs naturally with **`/gx-qbugs`** — after a `/gx-qa` run, `/gx-qbugs` reads the
  `qa/RUN-REPORT-<ts>.json` sidecar and files each FAILED workflow as a `bug`
  Issue + an fix idea in `.gainwix/<component>/inbox.md` (then `/gx-next`/`/gx-sing`/`/gx-ping` fix them via
  `/gx-go`). The loop: QA → file → fix → re-QA.
- It pairs naturally with `/gx-sweep` (run after merges to clean up branches).
- Deterministic browser engine = **Playwright/chromium**. The
  claude-in-chrome / computer-use browser agents remain available for *ad-hoc*
  exploration, but the repeatable suite uses the runner.
- The runner is re-runnable and CI-friendly: a human/CI can run Steps 1–3 with no
  Claude involvement; only the triage (Step 4) is Claude's value-add.
