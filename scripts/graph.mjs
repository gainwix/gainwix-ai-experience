// The dependency graph behind a component's backlog.
//
// ⛔ **The HTML is the source of truth, and this is the only thing that reads
// or writes it.** Items are parsed out of the table rows, the graph is computed
// here, and the whole file is written back. Nothing else edits it by hand —
// that is what the notice in `.gainwix/README.md` says, and this is what makes
// the notice true.
//
// # Why a script and not an instruction
//
// A command could describe the maths in prose and let the model do it. It must
// not. Vivek's rule is exact:
//
//   "Sequence is expressed only through Depends on. Nothing else orders the
//    work. The wave number is the length of the longest dependency chain
//    behind an item."
//
// That is a longest-path computation, it is checkable, and a model recomputing
// it every run will eventually get it wrong without saying so. ⭐ It is also
// the only part of this feature that CAN be tested, in a plugin that is
// otherwise markdown.

/** Rough days per size, used for the critical path and the day estimate. */
export const DAYS = { S: 0.5, M: 1.5, L: 4 };

/** Priorities, most important first. */
export const PRIORITIES = ["P0", "P1", "P2"];

/**
 * One backlog item.
 *
 * ⛔ `id` is permanent and never reused — a serial that has been retired stays
 * retired, so a PR that closed AB-014 still means the same thing a year later.
 * @typedef {{
 *   id: string, title: string, detail: string, spec: string,
 *   deps: string[], pri: string, size: string, lane: string, pr: string,
 *   status: string, issue: string, prLink: string, wave?: number
 * }} Item
 */

/**
 * Every item's wave: the length of the longest dependency chain behind it.
 *
 * Items in one wave never depend on each other, so they can be worked at the
 * same time by different people — or different Claude sessions.
 *
 * ⚠ **Refuses a cycle rather than hanging.** A → B → A has no longest path, and
 * the obvious recursive version blows the stack instead of saying so.
 */
export function computeWaves(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const wave = new Map();
  const state = new Map(); // unvisited | visiting | done

  const visit = (id, trail) => {
    if (state.get(id) === "done") return wave.get(id);
    if (state.get(id) === "visiting") {
      const cycle = [...trail.slice(trail.indexOf(id)), id].join(" → ");
      throw new Error(
        `the backlog has a dependency cycle and cannot be ordered: ${cycle}`,
      );
    }
    state.set(id, "visiting");
    const item = byId.get(id);
    let w = 0;
    for (const d of item.deps) {
      if (!byId.has(d)) {
        throw new Error(`${id} depends on ${d}, which is not in this backlog`);
      }
      w = Math.max(w, visit(d, [...trail, id]) + 1);
    }
    state.set(id, "done");
    wave.set(id, w);
    return w;
  };

  for (const i of items) visit(i.id, []);
  for (const i of items) i.wave = wave.get(i.id);
  return items;
}

/**
 * The longest weighted chain — the shortest the work can possibly take, however
 * many people are on it.
 */
export function criticalPath(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const memo = new Map();

  const longest = (id) => {
    if (memo.has(id)) return memo.get(id);
    const item = byId.get(id);
    let best = { days: 0, path: [] };
    for (const d of item.deps) {
      const r = longest(d);
      if (r.days > best.days) best = r;
    }
    const mine = {
      days: best.days + (DAYS[item.size] ?? 0),
      path: [...best.path, id],
    };
    memo.set(id, mine);
    return mine;
  };

  let best = { days: 0, path: [] };
  for (const i of items) {
    const r = longest(i.id);
    if (r.days > best.days) best = r;
  }
  return best;
}

/** The six numbers across the top of the page. */
export function kpis(items) {
  const waves = items.length ? Math.max(...items.map((i) => i.wave)) + 1 : 0;
  const perWave = new Map();
  for (const i of items) perWave.set(i.wave, (perWave.get(i.wave) ?? 0) + 1);
  const total = items.reduce((a, i) => a + (DAYS[i.size] ?? 0), 0);
  const cp = criticalPath(items);
  return {
    items: items.length,
    waves,
    p0: items.filter((i) => i.pri === "P0").length,
    maxParallel: perWave.size ? Math.max(...perWave.values()) : 0,
    days: Math.round(total),
    criticalPath: cp.path,
    criticalDays: Math.round(cp.days * 10) / 10,
    /** How much of the work can happen at once, at best. */
    parallelism: cp.days ? Math.round((total / cp.days) * 10) / 10 : 0,
  };
}

/** The next serial for a component, never reusing a retired one. */
export function nextSerial(items, prefix) {
  let max = 0;
  for (const i of items) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(i.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** Items in the order a person picks them up: wave, then priority, then serial. */
export function ordered(items) {
  const rank = (p) => {
    const i = PRIORITIES.indexOf(p);
    return i === -1 ? PRIORITIES.length : i;
  };
  return [...items].sort(
    (a, b) =>
      a.wave - b.wave || rank(a.pri) - rank(b.pri) || a.id.localeCompare(b.id),
  );
}

/**
 * The items that could be started right now: everything in the lowest wave
 * whose dependencies have all completed.
 *
 * ⛔ **One wave per execution.** Vivek: *"run only one wave per execution but
 * that one wave will kickoff parallel execution paths."* This returns that one
 * wave — the parallelism happens inside it, across agents, and never spills
 * into the next.
 */
export function readyWave(items, completedIds = []) {
  const done = new Set(completedIds);
  const open = items.filter((i) => !done.has(i.id));
  const startable = open.filter((i) => i.deps.every((d) => done.has(d)));
  if (!startable.length) return { wave: null, items: [] };
  const wave = Math.min(...startable.map((i) => i.wave));
  return { wave, items: ordered(startable.filter((i) => i.wave === wave)) };
}
