# Action Items

---

Your priority-ordered list of features and action items for Claude to execute on.

Top of the list = highest priority. Claude reads this file when asked what to
work on next.

Each `- ` line is one self-contained, one-PR-sized task. Order them by dependency
so a single `/gx-sing` (or `/gx-ping`) run can chomp top-to-bottom: every item
builds, tests green, and merges on its own, so if a session hits usage/token
limits mid-list it pauses cleanly — the merged items are already removed from
this file and `BACKLOG.md`, and a fresh `/gx-sing` resumes at the next unstarted
item.

This file is the **raw inbox**; `BACKLOG.md` is the **planned queue**. `/gx-next`
takes the top raw item, plans it into an executable task in `BACKLOG.md`, and
removes it from here. `/gx-go` never touches this file.

---

<!-- Add action items below this line -->
