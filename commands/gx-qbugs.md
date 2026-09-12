---
description: Triage the LATEST /gx-qa run's FAILURES into bug Issues + ACTION-ITEMS fix tasks. Read the newest qa/RUN-REPORT-<ts>.json, take only the failed workflows, GROUP them into discrete bugs (same root cause = one bug), and open ONE GitHub Issue labeled `bug` per discrete bug — each with its located WHERE (frontend vs backend), report excerpts, and ONLY that bug's screenshots (copied into a committed qa/bug-evidence/ path and embedded inline, since the full screenshot folders are gitignored). Cross-link related-but-distinct bugs. Append one ACTION-ITEMS.md fix task per bug (Closes #N). OPERATIONAL like /gx-qa//gx-sweep: creates issues + commits the bug-evidence + the ACTION-ITEMS queue edit to develop; NOT a /gx-go change. Idempotent via a [QA:<slug>] marker. Stops cleanly when there are no runs or no failures.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-qbugs — file the latest /gx-qa run's failures as bug Issues + fix tasks

`/gx-qbugs` is the bridge between `/gx-qa` (which *finds* integration bugs) and
`/gx-next` / `/gx-sing` / `/gx-ping` (which *fix* them). After a `/gx-qa` run produces a
RUN-REPORT, `/gx-qbugs` looks at the **FAILURE scenarios ONLY** in that latest run,
**groups them into discrete bugs** (failures with the same root cause are ONE
bug), and for each discrete bug (a) opens **one** GitHub **Issue labeled `bug`**
with all of that bug's context, report excerpts, and screenshots, and (b) appends
an `ACTION-ITEMS.md` fix task so a later `/gx-next`/`/gx-sing`/`/gx-ping` picks it up.
Passing workflows are ignored.

It reads the runner's machine-readable **`qa/RUN-REPORT-<ts>.json` sidecar** (not
the HTML) as a STABLE failure source — the same structured `results` object the
runner writes alongside every report.

**One discrete bug per Issue.** Each Issue is self-contained: exactly one bug,
with all of its related context, report excerpts, and the screenshots relevant to
*that* bug attached. If two failures share a root cause (e.g. one is a downstream
consequence of the other), they are the SAME bug → ONE Issue covering both
workflows. If two bugs are distinct but related (same feature/area), they get
SEPARATE Issues that are **cross-linked** ("Related: #N").

**Screenshots are attached, not just linked.** The full per-run screenshot folder
is gitignored (local-only, ~30 MB/run), so a blob URL to it would 404. Instead,
`/gx-qbugs` copies **only the screenshots relevant to each bug** into a committed
`qa/bug-evidence/<ts>/<bug>/` path and embeds them inline in that bug's Issue (via
a `raw.githubusercontent.com` URL pinned to the evidence commit). Only bug
screenshots are committed — never the whole run.

A `/gx-qbugs` run is **OPERATIONAL, like `/gx-qa` and `/gx-sweep`** — it creates the GitHub
Issues (remote-side) and commits the **bug-evidence screenshots** + the
**`ACTION-ITEMS.md` queue edit** directly to `develop` (a queue mutation, like
`/gx-next`). It does **NOT** run the `/gx-go` workflow, write a `changes/*.md`, or add a
`CHANGELOG.md` entry. (Modifying the `/gx-qbugs` machinery — this recipe — IS a
normal `/gx-go` code change; only *running* a triage is operational.) The *fixing* of
each filed bug happens later via the normal `/gx-go` workflow.

## What it operates on (read first)

- **Source:** the newest `qa/RUN-REPORT-<ts>.json` (the sidecar to
  `qa/RUN-REPORT-<ts>.html`). Its shape (the contract from `qa/runner/report.mjs`
  `writeJson`):
  ```
  { ts, startHuman, endHuman, startEpoch, endEpoch, baseUrl, screenshotDir,
    workflows: [ { name, slug, route, surfaces, mode, status, tested[],
      steps: [ { label, screenshot, ok } ],
      error?: { message,
                where: { step?, route?, component?, endpoint?, httpStatus? },
                screenshot? } } ] }
  ```
  A **failure** is a workflow with `status === "fail"`; it carries an `error`
  (message + located `where` + the failure screenshot filename), and its
  `steps[].screenshot` are the per-step PNGs (the repro path) — all of which live
  (local-only) under `qa/RUN-REPORT-<ts>/`.
- **Targets it writes:** GitHub Issues (label `bug`); committed
  `qa/bug-evidence/<ts>/<bug>/` screenshots; appended raw lines in
  `ACTION-ITEMS.md`. It never edits `qa/RUN-REPORT-*` (the run output),
  `BACKLOG.md`, or any app source.
- **Idempotence marker:** every Issue body + ACTION-ITEMS line carries a stable
  `[QA:<slug>]` marker for **each** workflow the bug covers, so a re-run never
  double-files a failure already in an open bug Issue.

## Step 0 — Pre-flight

```bash
git fetch origin develop                 # be on develop (or a develop-tracking branch) + synced
git status --porcelain ACTION-ITEMS.md   # expect EMPTY; if not, STOP — do not mix edits
gh label create bug --color d73a4a --description "QA-found defect" 2>/dev/null || true
gh auth status                           # required for issue create + dedup search
```

If `ACTION-ITEMS.md` is dirty, or `gh auth` fails, STOP and report (do not append
onto a dirty queue / cannot file issues).

## Step 1 — Find the latest run

```bash
LATEST_JSON="$(ls -1 qa/RUN-REPORT-*.json 2>/dev/null | sort | tail -n1)"
```

If there is **no** `qa/RUN-REPORT-*.json`, print **"No QA runs found — run `/gx-qa`
first."** and STOP. (Pre-sidecar runs have only `.html`; if only `.html` exists,
say a JSON sidecar is required — re-run `/gx-qa` — and STOP.) Capture the run
timestamp `TS` (the `ts` field / filename stamp) for evidence paths + Issue
bodies.

## Step 2 — Read failures ONLY

```bash
jq -r '.workflows[] | select(.status=="fail") | .slug' "$LATEST_JSON"
```

If there are **zero** failures, print **"Latest run (<TS>) is all green — no
failures; no actions taken."** and STOP (no issues, no commit).

## Step 3 — Group failures into DISCRETE BUGS

Triage the failing workflows into discrete bugs. For each failure read
`error.message` + `error.where` (`route` / `component` / `endpoint` + `httpStatus`)
and decide:

- **Same bug (→ one Issue covering both):** failures with the **same root cause** —
  e.g. the same failing `endpoint` + status, the same component error, or where one
  failure is plainly a *consequence* of another (a step that can only fail because
  an earlier-in-the-pipeline thing is broken). Example: a reviewer-queue-empty
  failure and a reviewer-approve failure that fails *because* the queue is empty
  are ONE bug.
- **Distinct but related (→ separate Issues, cross-linked):** different root causes
  in the same feature/area (e.g. two separate admin-portal route bugs). File one
  Issue each, then cross-link with "Related: #N" (Step 7c).
- **Unrelated (→ separate Issues, no link).**

Produce a list of discrete bugs, each with: a short `bug_slug` (kebab id for the
root cause, used in the evidence path + dedup), the set of covered workflow
`slug`s, a one-line root-cause summary, and the frontend-vs-backend WHERE. Use
judgment — this grouping is the core of `/gx-qbugs`; when unsure whether two failures
are the same bug, keep them SEPARATE and cross-link them (safer than merging two
real bugs into one Issue).

## Step 4 — Dedup (idempotent)

For each discrete bug, SKIP it if it is already filed. A bug is "already filed" if
an OPEN `bug` Issue already carries **any** of its covered workflows' `[QA:<slug>]`
markers, or `ACTION-ITEMS.md` already has a line with one:

```bash
for slug in <covered slugs of this bug>; do
  gh issue list --state open --label bug --search "[QA:$slug]" --json number,title \
    --jq '.[] | "\(.number) \(.title)"'
  grep -F "[QA:$slug]" ACTION-ITEMS.md
done
```

If a bug is already (fully) filed, skip it + record the skip + WHY for the
roll-up. If a NEW workflow joined an already-filed bug, prefer commenting the
existing Issue over opening a duplicate. Otherwise proceed.

## Step 5 — Per discrete bug: select ONLY its screenshots + report excerpts

For each NEW discrete bug, gather **only the evidence relevant to that bug**:

- **Screenshots:** the covered workflow(s)' own PNGs under `qa/RUN-REPORT-<TS>/`.
  The runner names them `<slug>-NN-<label>.png`, so a workflow's full repro path is
  `qa/RUN-REPORT-<TS>/<slug>-*.png`, and the failure shot is `error.screenshot`.
  Take the **failure screenshot** (always) plus that workflow's **step
  screenshots** (the repro path — a handful, not the whole run). Do **NOT** include
  any other workflow's screenshots.
- **Report excerpt:** the per-workflow section from the run — `name`, `mode`, the
  `tested[]` steps (what was exercised), the `error.message`, and the located
  `where`. (You MAY read the HTML section `qa/RUN-REPORT-<TS>.html#wf-<slug>` or
  view a screenshot for a richer human summary; the JSON is the source of truth.)

## Step 6 — Copy the bug's screenshots into committed evidence + commit

Copy this bug's selected screenshots into a tracked evidence path (the full
`qa/RUN-REPORT-<TS>/` folder is gitignored; `qa/bug-evidence/**` is committed), so
they can be embedded in the Issue. Do this for every new bug, then commit + push
ONCE, and capture the commit SHA to pin the image URLs to.

```bash
for each new bug:
  DEST="qa/bug-evidence/${TS}/${bug_slug}"
  mkdir -p "$DEST"
  for slug in <covered slugs>; do cp qa/RUN-REPORT-${TS}/${slug}-*.png "$DEST"/; done

git add qa/bug-evidence/
git commit -m "qbugs: bug-evidence screenshots for run ${TS}

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin develop
EVIDENCE_SHA="$(git rev-parse HEAD)"     # pin Issue image URLs to this commit
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"   # owner/repo for raw URLs
```

(Committing pins the screenshots so the Issue renders them forever via
`raw.githubusercontent.com/<repo>/<EVIDENCE_SHA>/...`, even if `qa/bug-evidence/`
is pruned later. Only bug-relevant shots are committed — never the whole run.)

## Step 7 — Create ONE Issue per discrete bug

### 7a. Body (write to a temp file — error text has quotes/backticks; use `--body-file`)

```bash
TITLE="[bug] ${bug_summary}"             # concise; root-cause oriented
BODY_FILE="$(mktemp)"
cat > "$BODY_FILE" <<EOF
**QA-found bug** — filed by \`/gx-qbugs\` from run \`${TS}\`.

**Where (frontend vs backend):** ${where_human}
<!-- e.g. backend: endpoint /spa/v1/courses?track=all → wrong result · component CoursesController#filtered_courses -->

**Root cause / summary:** ${root_cause_one_liner}

**Affected QA workflow(s):**
$(for each covered workflow:)
- **${name}** (\`${slug}\`, mode \`${mode}\`) — failing step: ${where_step}; error: \`${short_error}\`. Marker: \`[QA:${slug}]\`

**Report excerpt (what was tested):**
\`\`\`
$(the tested[] lines for the covered workflow(s))
\`\`\`

**Error:**
\`\`\`
${error_message}
\`\`\`

**Screenshots (this bug only):**

![failure](https://raw.githubusercontent.com/${REPO}/${EVIDENCE_SHA}/qa/bug-evidence/${TS}/${bug_slug}/${error_screenshot})
$(optionally a couple of key step shots from the same evidence dir, each as its own ![label](raw URL))

**Full report:** \`qa/RUN-REPORT-${TS}.html#wf-${slug}\` (HTML committed; the per-run screenshot folder is local-only/gitignored — this Issue carries the relevant shots above).

---
_Reproduce: \`/gx-qa\` re-runs the covered workflow(s) every run (persistent regression suite). Fix via \`/gx-go\` once \`/gx-next\`/\`/gx-sing\`/\`/gx-ping\` picks up the matching ACTION-ITEMS task._
EOF

ISSUE_URL="$(gh issue create --label bug --title "$TITLE" --body-file "$BODY_FILE")"
rm -f "$BODY_FILE"
```

### 7b. Rules
- **Exactly one discrete bug per Issue** — all of its covered workflows, its
  report excerpts, and ONLY its screenshots, in this one Issue.
- Every covered workflow's `[QA:<slug>]` marker MUST appear in the body (Step 4's
  dedup search keys on it).
- Embed screenshots via the `EVIDENCE_SHA`-pinned `raw.githubusercontent.com`
  URL so GitHub renders them inline. Include the failure shot always; add a couple
  of key step shots only if they aid diagnosis (keep it to the relevant ones).
- State explicitly **frontend** or **backend** (from `error.where`).
- Capture each new Issue's `#N` + URL for 7c, Step 8, and the roll-up.

### 7c. Cross-link related bugs
After all the discrete-bug Issues are created, for any set you judged **related**
(Step 3), cross-link them so each points at the others — append a "Related: #a #b"
line to each related Issue's body (`gh issue edit <n> --body-file <updated>`), or
add a comment (`gh issue comment <n> --body "Related: #a #b"`). Keep each Issue's
own discrete bug intact — cross-links are references, not merges.

## Step 8 — Append one ACTION-ITEMS fix task per bug

For each NEW Issue, append ONE raw `- ` line to `ACTION-ITEMS.md` **below the
`<!-- Add action items below this line -->` marker** — a concrete BUG-FIX task
naming it a bug, referencing the Issue (`Closes #N`), the WHERE (frontend vs
backend + route/component/endpoint), the covered workflow(s), and each
`[QA:<slug>]` marker:

```
- BUG (QA): fix ${bug_summary} — Closes #${N}. WHERE: ${where_human} (${frontend_or_backend}). Affected QA workflow(s): ${slugs}; failing step: ${where_step}; error: ${short_error}. Issue has the screenshots + report excerpt. ${markers}
```

(`${markers}` = each covered `[QA:<slug>]`.) Append all new lines in one edit;
preserve the marker + existing content. Do **not** plan or execute the fix here.

## Step 9 — Commit the queue edit (operational)

```bash
git add ACTION-ITEMS.md
git commit -m "qbugs: file <N> bug(s) from run <TS> as issues + fix tasks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin develop
```

Commit ONLY `ACTION-ITEMS.md` here (the bug-evidence was already committed in Step
6). Skip if no new bugs were filed (everything deduped).

## Step 9b — Advance the issue kanban (`WIP` → `DONE`)

**Operational, like the bug-evidence / queue-edit commits** — no `changes/*.md`, no
`/gx-go`. This is the SAME `WIP`→`DONE` sweep `/gx-qa` does, included here for
consistency: a tracked kanban issue at `WIP` becomes `DONE` once **all its
subordinate issues are CLOSED AND the latest `/gx-qa` run is GREEN**.

**Note — `/gx-qbugs` normally DEFERS this sweep.** `/gx-qbugs` runs *because* a `/gx-qa` run
had FAILURES (it triages them), so the "latest run green" gate is usually false and
this step is a no-op — the sweep then happens on the next green `/gx-qa` (Step 5b
there). It's here only for consistency and for the case `/gx-qbugs` is invoked when
the latest run happens to be green (zero failures).

Read the failure count from the SAME newest `qa/RUN-REPORT-<ts>.json` already
loaded as `$LATEST_JSON` (Step 1). Only sweep when it has **zero** failures:

```bash
FAILS=$(jq '[.workflows[] | select(.status=="fail")] | length' "$LATEST_JSON")
if [ "$FAILS" -eq 0 ]; then
  for N in $(gh issue list --state open --label WIP --json number --jq '.[].number'); do
    body="$(gh issue view "$N" --json body -q .body)"
    # Only the "## Sub-issues" task-list lines ("- [ ] #<n>"), not prose mentions.
    subs=$(printf '%s\n' "$body" | grep -E '^- \[[ xX]\] *#[0-9]+' \
             | grep -oE '#[0-9]+' | tr -d '#' | sort -u)
    [ -z "$subs" ] && continue        # no subordinates yet → not ready for DONE
    all_closed=1
    for s in $subs; do
      st="$(gh issue view "$s" --json state -q .state)"
      [ "$st" = "CLOSED" ] || { all_closed=0; break; }
    done
    if [ "$all_closed" = 1 ]; then
      gh issue edit "$N" --remove-label WIP --add-label DONE && \
        gh issue close "$N" --reason completed
    fi
  done
else
  echo "Latest /gx-qa run has $FAILS failure(s) — deferring the WIP→DONE sweep to the next green /gx-qa run."
fi
```

- Advance `#<N>` only when it has **≥1** subordinate AND **every** subordinate is
  `CLOSED` AND the latest run is green. Best-effort; report which issues advanced
  (usually none, since `/gx-qbugs` runs on a red run). Clearly OPERATIONAL — no
  `changes/*.md`, no `CHANGELOG.md`, no `/gx-go`.

## Step 10 — Summary + next steps

Print a roll-up:
- **Run triaged:** `<TS>` (`qa/RUN-REPORT-<TS>.json`); N failures → M discrete bug(s).
- **Issues created:** each `#N — <title>` (+ URL), with its covered workflow slug(s)
  and how many screenshots were attached.
- **Cross-links:** which Issues were linked as related.
- **ACTION-ITEMS added:** the bug-fix line(s).
- **Skipped (dedup):** each already-filed bug + WHY (open issue #N).
- **Kanban sweep (Step 9b):** which `WIP` issues advanced to `DONE` — normally
  none (deferred to the next green `/gx-qa`, since `/gx-qbugs` triages a red run).
- If no failures / no runs: the corresponding clean message (Step 1/2).

Then instruct: run **`/gx-next`** (plan one fix), **`/gx-sing`** (plan + fix serially),
or **`/gx-ping`** (parallel) to pick up the fix task(s) — the actual fixing is the
normal **`/gx-go`** workflow (each fix = its own branch + PR + `changes/*.md` +
`CHANGELOG.md`, with the Issue auto-closed by `Closes #N`).

## Notes

- **Failures only.** Passing workflows are ignored — `/gx-qbugs` files bugs, not greens.
- **One discrete bug per Issue**, with ALL its context + report excerpts + ONLY
  its screenshots; related-but-distinct bugs get separate, cross-linked Issues.
- **Screenshots are committed bug-evidence, not blob links** — only the relevant
  shots, copied to `qa/bug-evidence/<ts>/<bug>/` and embedded via a SHA-pinned raw
  URL (the full run folder stays gitignored).
- **Operational, not `/gx-go`** — creates Issues + commits the bug-evidence + the
  `ACTION-ITEMS.md` queue edit to `develop`; no `changes/*.md` / `CHANGELOG.md`.
- **Issue kanban sweep (Step 9b).** Like `/gx-qa`, `/gx-qbugs` advances each OPEN `WIP`
  issue whose subordinates are ALL closed to `DONE` — but ONLY when the latest
  `/gx-qa` run is green. Since `/gx-qbugs` triages a RED run, this normally DEFERS to the
  next green `/gx-qa` (it's here for consistency / the green-run-invocation case).
- **Idempotent** via `[QA:<slug>]` — re-running never double-files a still-open bug.
- **Depends on `/gx-qa` having run** (reads `qa/RUN-REPORT-<ts>.json`); stops cleanly
  with no run.
- **Pairs with `/gx-qa`:** `/gx-qa` finds bugs → `/gx-qbugs` files them (one Issue per bug,
  with screenshots) → `/gx-next`/`/gx-sing`/`/gx-ping` fix them via `/gx-go`.
