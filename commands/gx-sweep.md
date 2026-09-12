---
description: Repository-hygiene sweep — runs in two phases. Phase 0 cleans up old local QA reports (`qa/RUN-REPORT-<ts>.{html,json,/}` + their `RUN-LOG.md` entries) so the local checkout doesn't accumulate stale runs: any run older than the latest is removed, and the latest is removed too if it had ZERO failures (kept only if it still has actionable bugs). Phase 1 prunes merged branches — delete every REMOTE branch whose PR is merged (excluding protected `main`/`develop`/`master` and any branch still with an OPEN PR), then prune the matching LOCAL branches + their worktrees and stale remote-tracking refs. Operational, not a code change (no `changes/*.md`, no `CHANGELOG.md` entry, no `/gx-go` workflow), but the QA cleanup phase IS a small commit (it touches tracked report files + `RUN-LOG.md` — same spirit as `/gx-qa` / `/gx-qbugs` operational commits).
disable-model-invocation: true
---

> ⛔ **Paths changed on 12 Sept.** The queue no longer lives in the repo root.
> **Read `${CLAUDE_PLUGIN_ROOT}/docs/where-things-live.md` before acting on any
> file named below** — `BACKLOG.md` is now `.gainwix/<component>/backlog.html`,
> `CHANGELOG.md` and `changes/` are per component, and every read or write goes
> through `node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs`. ⚠ Mentions of the
> old root paths in the prose below are being rewritten command by command; where
> one disagrees with that document, **that document wins.**

# /gx-sweep — clean up old QA reports, then prune merged branches

`/gx-sweep` is a repository-hygiene command. It runs in two phases:

1. **Phase 0 — local QA report cleanup.** A long-running checkout accumulates
   `qa/RUN-REPORT-<ts>.html` + `.json` + the local `qa/RUN-REPORT-<ts>/` screenshot
   folder for every `/gx-qa` run, plus a `RUN-LOG.md` entry per run. Old runs lose
   value fast — once a regression is fixed, the run that surfaced it is just
   historical noise; once a run is green, even the run itself is historical noise
   (the durable signal lives in `develop`'s tip + the closed bug Issues). Phase 0
   keeps only the **latest run, AND only if it still has failures** (i.e. there
   are still actionable bugs to fix), and removes everything else.
2. **Phase 1 — merged-branch sweep.** Removes the branch detritus left behind
   after PRs are squash-merged — when `gh pr merge --delete-branch` did not run
   (a worktree still held the local branch and the delete step aborted), or when
   branches were merged from another machine/session.

`/gx-sweep` is **operational, not a `/gx-go` change**: it writes **no** `.gainwix/<component>/changes/*.md`
record and **no** `.gainwix/<component>/CHANGELOG.md` entry, and does **not** run the `/gx-go` workflow.
Phase 0 makes ONE small commit (it touches tracked report files + `RUN-LOG.md` —
same spirit as `/gx-qa` / `/gx-qbugs`, which commit their operational artifacts
directly to `develop`); Phase 1 makes no commit at all (it only mutates remote +
local branches and refs). (Building or modifying `/gx-sweep` itself — this
recipe — IS a normal `/gx-go` code change; only *running* `/gx-sweep` is operational.)

## Safety contract (read first)

### Phase 0 — QA report cleanup

A QA report is removed ONLY if both of these hold:

- It is **not** the latest run (newest `qa/RUN-REPORT-*.json` by timestamp), OR
  the latest run itself has **zero failures** (i.e. is all-green and so carries
  no actionable bug evidence).
- Its `qa/RUN-REPORT-<ts>.html` + `qa/RUN-REPORT-<ts>.json` + (local-only,
  gitignored) `qa/RUN-REPORT-<ts>/` screenshot folder + its `RUN-LOG.md` entry
  are all candidates for removal in this pass.

**`qa/bug-evidence/` is LEFT ALONE.** Bug-evidence directories are referenced
from closed GitHub Issues via SHA-pinned `raw.githubusercontent.com` URLs and are
preserved as historical context for those Issues; only run reports are pruned by
`/gx-sweep`. (Add a dedicated `/gx-sweep-bug-evidence` later if you ever want to prune
old bug-evidence too.)

When in doubt, the cleanup keeps the file. The latest-with-failures rule means
**you can always re-run `/gx-qbugs` against the last-kept run** to file any
unfiled bug — Phase 0 never strips the source of an unfiled bug.

### Phase 1 — branch sweep

A branch is deleted ONLY if ALL of these hold:

- It is **not** a protected branch (`main`, `develop`, `master`).
- It has a **merged** PR (per `gh pr list --state merged`).
- It does **not** also have an **open** PR (an open PR's branch is never touched).

Branches with **no PR at all** are LEFT ALONE — they may be unpushed/WIP work.
When in doubt, `/gx-sweep` keeps the branch. Always print the delete set and eyeball
it BEFORE deleting.

### Concurrency

Other sessions may have in-flight branches or be mid-`/gx-qa` run. Prefer running
`/gx-sweep` when no other session is mid-work — but the guards make it safe either
way: Phase 0 only removes runs whose timestamps are strictly older than the
latest at the moment it reads `qa/RUN-REPORT-*.json` (a concurrent `/gx-qa` writing
a newer report just means its run is now the latest and is not touched); Phase 1
spares any branch with an **open** PR; deleting another session's already-merged
branch is harmless.

## What it does

Phase 0 — QA report cleanup (runs FIRST):

0. **Find the latest run.** `LATEST_JSON = newest qa/RUN-REPORT-*.json by name`
   (the timestamps in the filename sort lexically). Compute its failure count
   from `[.workflows[] | select(.status=="fail")] | length`.
   - If there is **no** run report on disk, skip Phase 0 entirely (nothing to
     clean) and continue to Phase 1.
   - If the latest run has `≥ 1` failure, the latest run **stays**; every other
     run is removed.
   - If the latest run has **0** failures, the latest run is removed too; every
     other run is also removed.
1. **Remove each scheduled run.** For each removed run timestamp `TS`:
   - `git rm -f qa/RUN-REPORT-${TS}.html qa/RUN-REPORT-${TS}.json` — drop the
     tracked report files.
   - `rm -rf qa/RUN-REPORT-${TS}` — drop the local-only (gitignored) screenshot
     folder. (Use `rm -rf`, not `git rm`, because the folder is gitignored —
     `git rm` would fail; the folder may also not exist if the run was committed
     from another machine.)
   - Strip the matching line from `qa/RUN-LOG.md` (any line containing
     `RUN-REPORT-${TS}`).
2. **Commit + push.** If anything was removed, commit (`sweep(qa): remove N old
   QA report(s)`) and push to `develop` so other checkouts converge. If nothing
   was removed, no commit is made.

Phase 1 — branch sweep (runs AFTER, unchanged from before):

3. **Remote sweep.** Compute the delete set
   `(remote heads) ∩ (merged-PR heads) − (open-PR heads) − {main,develop,master}`
   and remove them in one batch with `git push origin --delete …`. Print the set
   first; if it is empty, say so and skip.
4. **Local prune.** For each branch in that merged set that also exists locally:
   if a git worktree holds it, `git worktree remove` that worktree first (only if
   it is clean — skip + report any worktree with uncommitted changes), then
   `git branch -D` the branch. Never delete the branch you are currently on.
5. **Tidy refs.** `git fetch --prune origin` to drop stale remote-tracking refs,
   and `git worktree prune` to clear dangling worktree admin entries.
6. **Report.** Print the Phase 0 + Phase 1 deltas: QA runs removed (with
   timestamps + each's pass/fail), QA commit SHA (if any), remote branches
   deleted, local branches deleted, worktrees removed, anything skipped (and
   why), and the surviving remote branches (normally just `main` + `develop`).

## Reference implementation

Run from a checkout you are NOT about to delete — Phase 0 commits to `develop`,
so it must run from a checkout on `develop` (or a worktree tracking it). Phase 1
remote ops are safe from anywhere; do the local-branch/worktree ops from
`main`/`develop` or another worktree. `git push origin --delete` is **remote-only**
and never dirties a working tree.

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

# ============================================================================
# Phase 0 — local QA report cleanup
# ============================================================================
LATEST_JSON="$(ls -1 qa/RUN-REPORT-*.json 2>/dev/null | sort | tail -n1)"
if [ -z "$LATEST_JSON" ]; then
  echo "Phase 0: no QA runs found — skipping."
else
  LATEST_TS="${LATEST_JSON#qa/RUN-REPORT-}"
  LATEST_TS="${LATEST_TS%.json}"
  LATEST_FAILS="$(jq '[.workflows[] | select(.status=="fail")] | length' "$LATEST_JSON" 2>/dev/null || echo 0)"

  if [ "${LATEST_FAILS:-0}" -gt 0 ]; then
    KEEP_TS="$LATEST_TS"
    echo "Phase 0: latest run $LATEST_TS has $LATEST_FAILS failure(s) — keeping it."
  else
    KEEP_TS=""
    echo "Phase 0: latest run $LATEST_TS is all green — removing it too."
  fi

  # Walk every report; remove all whose TS != KEEP_TS.
  removed_count=0
  removed_ts=()
  for f in qa/RUN-REPORT-*.json; do
    [ -f "$f" ] || continue
    ts="${f#qa/RUN-REPORT-}"
    ts="${ts%.json}"
    [ "$ts" = "$KEEP_TS" ] && continue
    echo "Phase 0: removing QA run $ts"
    git rm -f "qa/RUN-REPORT-${ts}.html" "qa/RUN-REPORT-${ts}.json" 2>/dev/null || true
    rm -rf "qa/RUN-REPORT-${ts}"
    if [ -f qa/RUN-LOG.md ]; then
      tmp="$(mktemp)"
      grep -v "RUN-REPORT-${ts}" qa/RUN-LOG.md > "$tmp" && mv "$tmp" qa/RUN-LOG.md
    fi
    removed_count=$((removed_count + 1))
    removed_ts+=("$ts")
  done

  # Commit + push if anything changed.
  if [ "$removed_count" -gt 0 ]; then
    git add qa/RUN-LOG.md
    git commit -q -m "sweep(qa): remove ${removed_count} old QA report(s)

Removed: ${removed_ts[*]}
Kept:    ${KEEP_TS:-<none — latest run was all-green>}

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
    git push origin HEAD:develop
    echo "Phase 0: committed cleanup of ${removed_count} run(s)."
  else
    echo "Phase 0: nothing to remove."
  fi
fi

# ============================================================================
# Phase 1 — merged-branch sweep
# ============================================================================

# 1. Compute the delete set: remote branches with a MERGED PR, minus protected,
#    minus any branch that still has an OPEN PR. (comm inputs must be sorted.)
git ls-remote --heads origin | awk '{print $2}' | sed 's#refs/heads/##' \
  | grep -vE '^(main|develop|master)$' | sort -u > /tmp/sweep_remote.txt
gh pr list --repo "$REPO" --state merged --limit 1000 --json headRefName \
  --jq '.[].headRefName' | sort -u > /tmp/sweep_merged.txt
gh pr list --repo "$REPO" --state open   --limit 1000 --json headRefName \
  --jq '.[].headRefName' | sort -u > /tmp/sweep_open.txt
comm -12 /tmp/sweep_remote.txt /tmp/sweep_merged.txt \
  | comm -23 - /tmp/sweep_open.txt > /tmp/sweep_delete.txt

echo "Phase 1: merged remote branches to delete ($(wc -l < /tmp/sweep_delete.txt)):"
cat /tmp/sweep_delete.txt

# 2. Delete them in one batch (only if the set is non-empty).
[ -s /tmp/sweep_delete.txt ] && \
  git push origin --delete $(tr '\n' ' ' < /tmp/sweep_delete.txt)

# 3. Local prune: drop merged local branches + their (clean) worktrees,
#    never the current branch; then tidy refs.
cur="$(git rev-parse --abbrev-ref HEAD)"
while read -r b; do
  [ -z "$b" ] && continue
  [ "$b" = "$cur" ] && continue
  wt="$(git worktree list --porcelain | awk -v B="refs/heads/$b" '
    $1=="worktree"{p=$2} $1=="branch"&&$2==B{print p}')"
  [ -n "$wt" ] && git worktree remove "$wt" 2>/dev/null
  git branch -D "$b" 2>/dev/null
done < /tmp/sweep_delete.txt
git fetch --prune origin
git worktree prune

# 4. Report.
echo "Surviving remote branches:"; git ls-remote --heads origin | awk '{print $2}' | sed 's#refs/heads/##'
```

Adjust the limits if the repo has more than 1000 merged/open PRs.

## Notes

- `/gx-sweep` is **destructive on QA reports and on branches** (never on app code).
  Phase 0 is guarded by the latest-with-failures rule; Phase 1 is guarded by the
  merged-PR + open-PR checks. Confirm the printed Phase 0 + Phase 1 sets first.
- Phase 0 commits to `develop`; Phase 1 does not. So a `/gx-sweep` against a repo
  with zero QA runs is a pure branch sweep with no commit; against a repo with
  old reports + nothing to sweep on branches, it makes one commit and otherwise
  does nothing.
- `/gx-sweep` pairs naturally with `/gx-ping` and `/gx-sing` (after a long run that
  squash-merged many PRs, a single `/gx-sweep` clears every leftover branch in one
  pass) and with `/gx-qa` / `/gx-qbugs` (after a successful regression fix, `/gx-sweep`
  removes the now-historical run reports while keeping any latest run that still
  carries actionable bugs).
- The latest-with-failures rule is intentional: it preserves the source of
  unfiled bugs. Re-running `/gx-qbugs` against the kept run always succeeds because
  Phase 0 never removes the run it would read.
