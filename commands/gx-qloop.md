---
description: QA convergence loop — runs /gx-qa → (if failures) /gx-qbugs → /gx-ping repeatedly until a /gx-qa run is all-green (zero failures), then exits. Automates the find → file → fix → re-QA cycle end-to-end under the BACKLOG.md autonomy preamble. Bounded by a max-iteration cap (default 5; override `/gx-qloop <N>`) plus NO-PROGRESS / NOTHING-TO-FIX guards so it never spins. Operational orchestration: it COMPOSES /gx-qa + /gx-qbugs + /gx-ping (each keeps its own contract); /gx-qloop itself writes no changes/*.md or CHANGELOG entry. Only BUILDING this machinery is a /gx-go change.
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-qloop — QA convergence loop (`/gx-qa` → `/gx-qbugs` → `/gx-ping`, until green)

`/gx-qloop` ("**Q**A **Loop**") drives the stack to a **green QA suite** by running
the existing `/gx-qa` → `/gx-qbugs` → `/gx-ping` commands in a loop until a `/gx-qa` run
reports **zero failures**, then exits. It is the autopilot for the find → file →
fix → re-QA cycle: one command instead of hand-running `/gx-qa`, `/gx-qbugs`, `/gx-ping`,
`/gx-qa`, … yourself. It runs under the `### Autonomy preamble (read first)` in
`BACKLOG.md` — **no confirmation prompts** between sub-commands.

`/gx-qloop` is a **meta / orchestrator** command: it COMPOSES the three commands and
does NOT reimplement them. Each keeps its own contract — `/gx-qa` and `/gx-qbugs` are
**operational** (they commit `qa/` artifacts, the bug-evidence, and the
`ACTION-ITEMS.md` queue edit directly to `develop`), and each `/gx-ping` fix is its
**own PR + `changes/*.md` + `CHANGELOG.md`**. `/gx-qloop` itself writes **no** extra
artifacts, runs **no** `/gx-go` of its own, and adds **no** `changes/*.md` /
`CHANGELOG.md` entry for the loop run. (Only **building** the `/gx-qloop` machinery —
this recipe — is a `/gx-go` change.)

## Invocation

- `/gx-qloop` — run with the default max-iteration cap (**5**).
- `/gx-qloop <N>` — override the cap (e.g. `/gx-qloop 8`).

## The loop (one iteration)

1. **`/gx-qa`** — boot the stack, run the whole `qa/QA.md` suite, triage, and commit
   the `qa/RUN-REPORT-<ts>.{html,json}` + `qa/RUN-LOG.md` to `develop`
   (operational). If `qa/QA.md` has **no** workflows, `/gx-qa` aborts — so does
   `/gx-qloop` (nothing to converge).
2. **Check the result** — read the newest `qa/RUN-REPORT-<ts>.json` sidecar's
   failures (`workflows[] | select(.status=="fail")`).
   - **Zero failures → EXIT (GREEN).** The suite is green; print the success
     roll-up ("QA suite green after N iteration(s)") and STOP.
   - Otherwise capture the **set of failing workflow slugs** for this iteration
     (the NO-PROGRESS guard compares it against the next iteration's set).
3. **`/gx-qbugs`** — triage those failures into discrete bugs: file one `bug` Issue
   per discrete bug + append one `ACTION-ITEMS.md` fix task each (idempotent via
   the `[QA:<slug>]` markers). Record how many **new** bugs were filed (vs deduped
   to already-open Issues).
4. **`/gx-ping`** — build + serially integrate the queued fix tasks (each fix = its
   own branch → PR → `changes/*.md` → squash-merge). Record how many fix PRs
   merged.
5. **Loop** back to step 1 — re-run `/gx-qa` to verify the fixes landed (and surface
   the next layer). No prompts.

## Termination — exit on ANY of these (whichever comes first)

The loop is bounded; it can never run unbounded or spin on un-converging
failures. Exit (and print the roll-up) on the FIRST of:

- **GREEN** *(the success exit)* — a `/gx-qa` run reports **0 failures**. This is the
  goal: the whole `qa/QA.md` suite passes.
- **MAX ITERATIONS** — a hard cap on iterations (**default 5**; override with
  `/gx-qloop <N>`). Stop + surface the remaining failures.
  *(Cost: each iteration is a full `/gx-qa` + `/gx-qbugs` + N× `/gx-go` — one per `/gx-ping`
  fix — i.e. roughly N× the tokens of a single fix cycle. The cap keeps the spend
  bounded.)*
- **NO PROGRESS** — track the set of failing workflow slugs across iterations. If
  an iteration does **not shrink** it (no workflow newly passes vs the previous
  `/gx-qa` — the same-or-worse failures), STOP and surface the **stuck** failures.
  This is the guard against spinning on flaky/timing failures or on failures the
  queued fixes don't actually resolve.
- **NOTHING TO FIX** — if `/gx-qa` has failures but `/gx-qbugs` files **no new** bugs
  (everything dedups to still-open Issues) **and** `/gx-ping` merges **nothing**
  (queue empty / no fix made progress), STOP and surface (the open bugs need
  attention outside the loop — a human decision or a non-trivial fix).

## Flaky / timing failures

Persistent **flaky or timing** failures — e.g. the dev-stack per-step-timeout
class (a `login`/queue click that intermittently exceeds `QA_TIMEOUT` late in a
long run) — won't "fix" themselves through `/gx-qbugs` → `/gx-ping`, so they trip the
**NO-PROGRESS** guard. When that happens, **surface them as "needs a QA-infra fix
or a manual look"** (raise `QA_TIMEOUT`, restart the dev server mid-run, mark the
workflow `serial`, give it a distinct identity, …) rather than spinning. `/gx-qloop`
does not retry flakes indefinitely.

## Hard safety rules

- **One driver at a time.** Don't run a second `/gx-qloop` / `/gx-ping` / `/gx-sing`
  against the same `develop` concurrently — they'd race the shared queue files
  (`ACTION-ITEMS.md` / `BACKLOG.md`) and the `develop` tip.
- **Never weaken a sub-command's contract.** `/gx-qa` still resets the isolated `_qa`
  DB each run; `/gx-qbugs` stays idempotent via `[QA:<slug>]`; each `/gx-ping` fix stays
  one-PR-per-change with its `changes/*.md` + `CHANGELOG.md`.
- **Never invent fixes outside the queue.** `/gx-qloop` only fixes what `/gx-qbugs`
  files and `/gx-ping` builds; if a failure can't be filed/fixed that way it exits
  via NOTHING-TO-FIX / NO-PROGRESS rather than improvising.
- `/gx-qloop` writes **no** `changes/*.md` and **no** `CHANGELOG.md` entry for the
  loop run itself (the sub-commands write everything). Building/altering the
  `/gx-qloop` recipe IS a `/gx-go` change.

## Report

Print one consolidated roll-up covering the whole loop:

```
/gx-qloop complete:

  Iterations: N (cap M)
    Iter 1:  /gx-qa 27/34 (7 fail) → /gx-qbugs filed 3 bug(s) → /gx-ping merged 3 fix(es)
    Iter 2:  /gx-qa 28/34 (6 fail) → /gx-qbugs filed 1 bug(s) → /gx-ping merged 1 fix(es)
    Iter 3:  /gx-qa 34/34 (0 fail) → GREEN
  Convergence: 27 → 28 → 34 passing (of 34)

  Exit reason: GREEN | MAX-ITERATIONS | NO-PROGRESS | NOTHING-TO-FIX

  Remaining failures (only if not GREEN):
    • <slug> — <located WHERE / why stuck, e.g. "flaky step timeout — needs QA-infra fix">

  Reports:  qa/RUN-REPORT-<latest-ts>.html  (+ qa/RUN-LOG.md)
  Issues:   #a #b …   (bug Issues filed across the loop)
  Fix PRs:  #x #y …   (fix PRs merged across the loop)
```

## Notes

- **`/gx-qloop` vs the manual loop.** `/gx-qloop` is exactly `/gx-qa` → (`/gx-qbugs` →
  `/gx-ping`)\* → green, run for you. Use it to converge the QA suite hands-free; run
  the commands individually when you want to inspect/triage between steps.
- **Each round's artifacts are real + auditable.** Every `/gx-qa` commits its report,
  every `/gx-qbugs` files real Issues + queue tasks, every `/gx-ping` ships real PRs —
  so the loop's progress is fully visible in `qa/RUN-LOG.md`, the GitHub `bug`
  Issues, and `CHANGELOG.md`, even though `/gx-qloop` itself records nothing extra.
- **Bounded by design.** GREEN is the only "success" exit; MAX-ITERATIONS /
  NO-PROGRESS / NOTHING-TO-FIX are the safety exits that keep it from running
  forever or spinning on what it cannot fix. It always prints WHY it stopped.
- **Pairs with `/gx-sweep`.** After a `/gx-qloop` run merges a pile of fix PRs, run
  `/gx-sweep` to prune the merged branches.
