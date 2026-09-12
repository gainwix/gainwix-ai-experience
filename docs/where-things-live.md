# Where things live

*Every `/gx-*` command reads this. **It is the only place the paths are written
down** — before this file they were repeated across fifteen command files, which
is exactly why moving them was expensive.*

---

## The layout

```
.gainwix/
  README.md                    why this directory is not hand-edited
  autonomy.md                  what the operator has pre-approved — /gx-go reads this
  deploy-context.json          ⛔ the production gate reads THIS EXACT PATH
  current                      which component the commands are acting on
  <component>/
    backlog.html               everything still to do, in dependency order
    in-progress.html           only what is being worked on now — transient
    completed.html             what landed, with the PR that landed it
    changes/                   one record per executed task
    CHANGELOG.md               the index of those records
```

⛔ **Nothing goes in the repo root.** Not `BACKLOG.md`, not `ACTION-ITEMS.md`,
not `changes/`. A repo's root belongs to the person who owns the repo.

⛔ **`deploy-context.json` is never moved or nested.** `hooks/gate-production.js`
reads `<cwd>/.gainwix/deploy-context.json` on every command; anywhere else and
every deploy is silently treated as production.

---

## Never edit these files by hand

The tool parses a file, recomputes what depends on what, and **writes the whole
file back**. A hand edit is either overwritten on the next run or — worse — kept
next to a dependency order that no longer matches it.

⭐ **The HTML is the source of truth.** There is no JSON beside it, deliberately:
two files means two things to drift apart.

---

## The one command that touches them

```bash
GX="node ${CLAUDE_PLUGIN_ROOT}/scripts/gx-backlog.mjs"

$GX detect                     # what does this repo build, and what does it already have?
$GX create  --component api --prefix API
$GX components                 # what is set up here
$GX use     --component api    # remember which one to act on
$GX show    [--stage backlog]  # the queue, in pick-up order
$GX ready                      # ⭐ the ONE wave that can start now
$GX add     --title "…" [--detail …] [--deps "AB-001 AB-002"]
            [--pri P0|P1|P2] [--size S|M|L] [--lane auth] [--spec "Spec §4"]
$GX move    --id AB-003 --to in-progress|completed [--issue URL] [--pr-link URL]
$GX rebuild                    # recompute every stage, after a merge or a hand-edit
```

⚠ **Add `--component <name>` to any of them** when a repo has more than one and
you do not want to change the remembered choice.

---

## How the order is decided

**Sequence comes only from `Depends on`. Nothing else orders the work.**

A **wave** is the length of the longest dependency chain behind an item — so
items in one wave never depend on each other and can be worked at the same time,
by different people or different Claude sessions.

⛔ **An item may start once every serial it depends on has MERGED.** Being picked
up is not being done: `in-progress` means *already taken*, never *finished*, and
it unblocks nothing.

⛔ **`ready` returns ONE wave.** The parallelism happens inside it, across
agents. It never spills into the next wave.

⭐ **Serials are permanent and never reused.** `AB-014` means the same thing a
year later, which is what lets a PR reference one.

**Priority** decides what to pick first *within* a wave — never across waves, and
never instead of dependencies.

---

## The chain

```
second brain  →  spec  →  backlog  →  in progress  →  completed
```

⚠ **The spec stage is not built yet.** Until it is, items arrive in the backlog
from `/gx-next` or straight from `$GX add`.
