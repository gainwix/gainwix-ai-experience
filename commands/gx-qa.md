---
description: End-to-end QA — boot the stack (railsaptonaiapi :3000 on an isolated seeded QA DB + webaptonai :5173), run every workflow in qa/QA.md through Playwright/chromium, capture per-step screenshots, emit a self-contained paginated qa/RUN-REPORT-<ts>.html with linked screenshots + highlighted located errors, prepend qa/RUN-LOG.md, then triage failures (root-cause WHERE — frontend vs backend). OPERATIONAL: commits the qa/ artifacts to develop; NOT a /gx-go change (no changes/*.md, no CHANGELOG entry). Aborts cleanly when qa/QA.md has no workflows.
disable-model-invocation: true
---

# /gx-qa — end-to-end QA run (browser + API), reported with screenshots

`/gx-qa` drives complete user journeys across BOTH tiers of the stack — the
`webaptonai` React SPA and the `railsaptonaiapi` JSON backend — through a real
browser (Playwright / chromium), captures a screenshot at every meaningful step,
and emits a shareable, self-contained HTML report plus a newest-first run log. It
is the cross-tier complement to the per-tier unit/integration suites: it catches
integration breaks (CSRF/cookie/proxy, serializer drift, route gaps, broken
pages) that isolated tests miss.

A `/gx-qa` **run is OPERATIONAL, like `/gx-sweep`** — it commits the small `qa/`
artifacts (the new `RUN-REPORT-<ts>.html`, its machine-readable
`RUN-REPORT-<ts>.json` sidecar, and the updated `RUN-LOG.md`) directly to
`develop`. The per-run **`RUN-REPORT-<ts>/` screenshot folder is NOT committed**
(it is gitignored — a full run is ~30 MB of PNGs; screenshots are LOCAL run
evidence the HTML links relatively, so they render locally right after a run, not
on GitHub). It does **NOT** run the `/gx-go`
workflow, does **NOT** write a `changes/*.md` record, and does **NOT** add a
`CHANGELOG.md` entry. (Building or modifying the `/gx-qa` machinery — the runner, the
report generator, this recipe — IS a normal `/gx-go` code change; only *running* a
QA pass is operational.)

## `qa/QA.md` is a PERSISTENT REGRESSION SUITE (read first)

Unlike `BACKLOG.md` — whose top item `/gx-go` **dequeues** as it ships — `qa/QA.md`
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
- **This command** is the Claude-facing wrapper: it boots both servers against an
  isolated seeded QA DB, invokes the runner, then **triages** the results —
  root-causing each failure and stating WHERE it lives (workflow step / SPA route
  / component / API endpoint + HTTP status, frontend vs backend) — and prints the
  roll-up. The runner already records a located error in the report; Claude's
  value-add is the human explanation + next step.

## Abort cleanly when there are no workflows

Read `qa/QA.md`. If its `## QA Workflows` section contains **no** `### ` workflow
entries (only the preamble / a commented template), print **"qa/QA.md has no QA
workflows — nothing to run."** and STOP. Produce no report, no screenshots, no
`RUN-LOG.md` change, and no commit. (The runner enforces this too: it exits
non-zero with that message when the parse yields zero workflows.)

## Step 1 — Prerequisites (one-time per machine, then reuse)

The runner resolves Playwright from `webaptonai/node_modules`, so that app's deps
+ the chromium browser must be present:

```bash
cd webaptonai
npm ci                              # node_modules is gitignored
npx playwright install chromium     # downloads the browser (needs network)
```

If chromium cannot download (offline/blocked), `/gx-qa` cannot do a live browser run
— say so and stop; do not fake screenshots.

## Step 2 — Boot the stack on a freshly RESET, isolated, seeded QA DB

Never run QA against a developer's dev data. Use a dedicated DB suffix
(`APTON_TEST_DB_SUFFIX=_qa`) and seed it with throwaway `APTON_AI_DEV_*` values.

**RESET the QA database every run — drop + recreate + reseed, not just
`db:prepare`.** The suite includes MUTATING workflows (the reviewer approves a
review: PREVIEW→REVIEWED; the approver approves & publishes: SUBMITTED→LIVE; the
org admin onboards the Frontend OU). Onboarding is one-way and a mutated course
does not return to its mid-lifecycle state on its own, so a plain idempotent
`db:prepare`/`db:seed` would leave those records advanced after the first run and
the mutation workflows would no longer find their actionable seed (e.g. "Cowork
Patterns" would no longer be in PREVIEW). Dropping + recreating + reseeding the
isolated `_qa` DB each run returns the seeded mid-lifecycle courses to
PREVIEW/SUBMITTED and the Frontend OU to un-onboarded, so the reviewer/approver/
onboard workflows are **deterministic and repeatable** on every `/gx-qa` run. The
`_qa` suffix keeps this reset confined to the throwaway QA DB — it never touches
dev/test data.

```bash
# 2a. RESET + seed the isolated QA database (drop → recreate → load → seed).
#     `db:reset` = db:drop + db:setup (recreate from structure.sql) + db:seed,
#     so it returns ALL seeded state (mid-lifecycle courses, OU onboarding) to
#     its initial state every run. Run under RAILS_ENV=test so the suffix applies.
cd railsaptonaiapi
RAILS_ENV=test APTON_TEST_DB_SUFFIX=_qa \
  APTON_AI_DEV_USER_PASSWORD=<throwaway-qa-pw> \
  APTON_SUPERADMIN_EMAIL=qa@example.com \
  APTON_SUPERADMIN_PASSWD=<throwaway-qa-pw> \
  bin/rails db:reset
# (Equivalent if db:reset is unavailable for the multi-DB layout:
#   RAILS_ENV=test APTON_TEST_DB_SUFFIX=_qa bin/rails db:drop db:prepare
#   then re-run the seed with the APTON_AI_DEV_* / APTON_SUPERADMIN_* env above:
#   ... APTON_AI_DEV_USER_PASSWORD=... bin/rails db:seed )

# 2b. Boot the API on :3000 against the QA DB (background).
APTON_TEST_DB_SUFFIX=_qa bin/rails server -p 3000 &

# 2c. Boot the SPA on :5173 (its /spa proxy targets the API on :3000) (background).
#     (Browser workflows use :5173; api workflows hit the API origin :3000 directly
#     via QA_API_BASE — the SPA proxy forwards /spa but not /api.)
cd ../webaptonai && npm run dev &
```

**2d. (api-mode workflows only) Resolve the learner Bearer token + the live quiz
id** for the `Mode: api` learner-journey workflows (GROUP 8 in `qa/QA.md`), against
the SAME isolated `_qa` DB. The runner can mint the token itself (it shells out to
`bin/rails runner` when `QA_API_TOKEN` is unset), but doing it here lets you export
both as env so the run is fully deterministic and the token is fetched ONCE:

```bash
# From railsaptonaiapi/. Mint a Bearer token for the seeded learner + read the
# live course's LIVE quiz id. Capture into shell vars (NOT written to the repo).
cd railsaptonaiapi
QA_API_TOKEN=$(RAILS_ENV=test APTON_TEST_DB_SUFFIX=_qa bin/rails runner \
  'print User.find_by!(email: "learner@demo.aptonworks.com").api_tokens.create!.plaintext')
QA_LIVE_QUIZ_ID=$(RAILS_ENV=test APTON_TEST_DB_SUFFIX=_qa bin/rails runner \
  'print Training::Quiz.live.api_served.first&.id')
export QA_API_TOKEN QA_LIVE_QUIZ_ID
```

The Bearer token is a SECRET — keep it in the shell env only; never echo it, write
it to a report, or commit it (the runner upholds this too: it never logs the token).
If you skip 2d, the runner auto-mints the token, but `${QA_LIVE_QUIZ_ID}` stays
unset and the quiz-attempt step in the full-journey workflow will 404/fail (by
design — it flags the missing id).

Use **throwaway placeholder** secrets only (e.g. a `qa-throwaway-pw`-style dummy)
— never real credentials, and never write cleartext real secrets into the repo or
a report (honor the no-cleartext-secrets rule). Wait until both ports answer
(poll `http://localhost:5173/` and `http://localhost:3000/up`) before running.

## Step 3 — Run the runner

From the repo root, with Playwright resolvable via `NODE_PATH` (optionally cap the
parallel pool with `QA_CONCURRENCY`, or widen the per-step timeout with
`QA_TIMEOUT`). **Export the same secrets you seeded with**, so the runner's
`${VAR}` substitution (below) resolves to the seeded credentials:

```bash
NODE_PATH=webaptonai/node_modules \
  QA_CONCURRENCY=2 \
  APTON_AI_DEV_USER_PASSWORD=<throwaway-qa-pw> \
  APTON_SUPERADMIN_EMAIL=qa@example.com \
  APTON_SUPERADMIN_PASSWD=<throwaway-qa-pw> \
  QA_API_BASE=http://localhost:3000 \
  QA_API_TOKEN="$QA_API_TOKEN" \
  QA_LIVE_QUIZ_ID="$QA_LIVE_QUIZ_ID" \
  node qa/runner/run.mjs --base http://localhost:5173
```

**API-mode workflows (`Mode: api`, GROUP 8).** These run with NO browser — the
runner drives the Bearer `/api/v1` delivery surface with `fetch` and records JSON
snapshots (no screenshots). They authenticate with the learner Bearer token from
`QA_API_TOKEN` (exported in Step 2d) — or, if that's unset, the runner mints one by
shelling out to `bin/rails runner` against the `_qa` DB (`QA_LEARNER_EMAIL`, default
`learner@demo.aptonworks.com`; whole command overridable via `QA_TOKEN_MINT_CMD`).
The token rides only in the `Authorization` header and is NEVER logged. Because the
SPA's Vite proxy forwards `/spa` but **not** `/api`, api workflows hit the Rails API
**origin directly** via `QA_API_BASE` (`http://localhost:3000`, or `--api-base`),
NOT through `:5173` — the Bearer API needs no cookie/CSRF/same-origin handling.
Validate the api machinery offline (no servers) with
`node qa/runner/validate-api-mode.mjs` (stands up an in-process mock `/api/v1`).

**Per-step timeout (`QA_TIMEOUT`, default `35000`ms):** each Playwright step
(`waitFor` / `click` / `fill` / `goto` / `networkidle`) is bounded by this
timeout (override via `QA_TIMEOUT=<ms>` or `--timeout <ms>`). The default is a
roomy 35s because the dev stack (Vite dev server + test-env Rails) slows down
measurably over a long (30+ workflow) run, so the heaviest serial steps late in
the run — typically a login/queue click — would intermittently exceed a tighter
budget and false-fail even when run `serial` (a dev-stack-degradation artifact,
not parallel contention). Raise it further against a slow CI box; lower it
against a fast production `vite preview` build.

### `${VAR}` / `${RUN_TS}` substitution in step args (secret-safe)

So that `qa/QA.md` never hardcodes credentials, the runner resolves `${…}` tokens
inside a step ARG (a `fill` value, a `goto` path, an `assertText` text) **at
step-execution time**:

- `${RUN_TS}` → the run's timestamp (e.g. `qa-signup-${RUN_TS}@example.com` mints a
  unique signup email each run).
- `${ANY_ENV}` → `process.env.ANY_ENV` (e.g. `${APTON_AI_DEV_USER_PASSWORD}`,
  `${APTON_SUPERADMIN_EMAIL}`, `${APTON_SUPERADMIN_PASSWD}`). An unset var resolves
  to `""` plus a one-line stderr warning that names **only the var** (never a value).

**Secret safety (do not regress):** the resolved value is passed **only** to
Playwright's `fill`/`goto`. It is **never** written to the report, `RUN-LOG.md`, a
screenshot filename, or stdout/stderr — a `fill` step's report label shows only its
**selector** (not the value), and password inputs render masked in screenshots.
That is why the workflow files reference `${APTON_…}` tokens instead of plaintext
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
- **Root-cause it** and state WHERE: which workflow step, which SPA route, which
  component, and — when a request failed — which API endpoint + HTTP status.
- **Attribute frontend vs backend.** A 4xx/5xx on a `/spa/**` call → backend
  (serializer/route/auth/CSRF). A page that mounts but a selector never appears,
  with no failing request → frontend (route/component/render). A redirect to
  `/login` on an authenticated route → session/cookie/guard wiring.
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
`qa/QA.md`, there is nothing to commit.) Do **not** create a `changes/*.md` and do
**not** touch `CHANGELOG.md`.

## Step 5b — Advance the issue kanban (`WIP` → `DONE`)

**Operational, like the qa-artifact commit** — no `changes/*.md`, no `/gx-go`. This
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
  `changes/*.md`, no `CHANGELOG.md`, no `/gx-go` workflow.

## Step 6 — Tear down

Stop the background servers you started (the API on :3000 and the SPA on :5173).
The `_qa` database can be left for the next run (re-seeding is idempotent) or
dropped with `APTON_TEST_DB_SUFFIX=_qa bin/rails db:drop`.

## Step 7 — Print the roll-up

Print: workflows run, pass/fail counts, the report path
(`qa/RUN-REPORT-<ts>.html`) + its `qa/RUN-REPORT-<ts>.json` sidecar +
`RUN-LOG.md` link, and — for any failure — the located root cause (step / route /
component / endpoint+status, frontend vs backend). Mention the run was committed
to `develop` as an operational `/gx-qa` run (no `changes/*.md`, no CHANGELOG entry).
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
  `CHANGELOG.md`). **Note:** this file was renamed from `RUNLOG.md` → `RUN-LOG.md`;
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
  Issue + an `ACTION-ITEMS.md` fix task (then `/gx-next`/`/gx-sing`/`/gx-ping` fix them via
  `/gx-go`). The loop: QA → file → fix → re-QA.
- It pairs naturally with `/gx-sweep` (run after merges to clean up branches).
- Deterministic browser engine = **Playwright/chromium**. The
  claude-in-chrome / computer-use browser agents remain available for *ad-hoc*
  exploration, but the repeatable suite uses the runner.
- The runner is re-runnable and CI-friendly: a human/CI can run Steps 1–3 with no
  Claude involvement; only the triage (Step 4) is Claude's value-add.
