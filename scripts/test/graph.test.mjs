// Tests for the dependency graph.
//
// ⭐ **This is the only part of the plugin that can be tested**, which is most
// of why the wave maths lives in a script and not in a command's prose. Run:
//
//     node --test scripts/test/
//
// The shapes here are small enough to work out by hand, so a failure says what
// is wrong rather than that something is.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeWaves,
  criticalPath,
  kpis,
  nextSerial,
  ordered,
  readyWave,
} from "../graph.mjs";

/** A minimal item — only the fields the graph actually reads. */
const it = (id, deps = [], extra = {}) => ({
  id,
  title: id,
  detail: "",
  spec: "",
  deps,
  pri: "P1",
  size: "M",
  lane: "platform",
  pr: "A",
  status: "backlog",
  issue: "",
  prLink: "",
  ...extra,
});

test("a wave is the longest dependency chain behind an item", () => {
  //  A ─┐
  //     ├─→ C ─→ D
  //  B ─┘
  //  E (alone)
  const items = computeWaves([
    it("A"),
    it("B"),
    it("C", ["A", "B"]),
    it("D", ["C"]),
    it("E"),
  ]);
  const w = Object.fromEntries(items.map((i) => [i.id, i.wave]));
  assert.deepEqual(w, { A: 0, B: 0, C: 1, D: 2, E: 0 });
});

test("the LONGEST chain wins, not the shortest", () => {
  // D depends on both A (chain of 1) and C (chain of 3). It must be wave 3,
  // because it cannot start until the long branch has merged.
  const items = computeWaves([
    it("A"),
    it("B", ["A"]),
    it("C", ["B"]),
    it("D", ["A", "C"]),
  ]);
  assert.equal(items.find((i) => i.id === "D").wave, 3);
});

test("items in one wave never depend on each other", () => {
  // The property that makes a wave safe to run in parallel. Stated as a test
  // because it is the whole reason waves exist.
  const items = computeWaves([
    it("A"),
    it("B"),
    it("C", ["A"]),
    it("D", ["A", "B"]),
    it("E", ["C", "D"]),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const i of items) {
    for (const d of i.deps) {
      assert.notEqual(
        byId.get(d).wave,
        i.wave,
        `${i.id} and ${d} are in the same wave and one depends on the other`,
      );
    }
  }
});

test("a dependency cycle is refused, and named", () => {
  // ⚠ The obvious recursive version blows the stack instead of saying so.
  assert.throws(
    () => computeWaves([it("A", ["C"]), it("B", ["A"]), it("C", ["B"])]),
    /dependency cycle/,
  );
});

test("a dependency that is not in the backlog is refused", () => {
  // Silently treating it as satisfied would order the work wrongly and nothing
  // would say why.
  assert.throws(
    () => computeWaves([it("A", ["GHOST-001"])]),
    /depends on GHOST-001/,
  );
});

test("the critical path is the longest WEIGHTED chain, not the longest chain", () => {
  // Three small items in a row (0.5 each) versus one large item (4). The
  // single L is the critical path even though its chain is shorter.
  const items = computeWaves([
    it("S1", [], { size: "S" }),
    it("S2", ["S1"], { size: "S" }),
    it("S3", ["S2"], { size: "S" }),
    it("BIG", [], { size: "L" }),
  ]);
  const cp = criticalPath(items);
  assert.deepEqual(cp.path, ["BIG"]);
  assert.equal(cp.days, 4);
});

test("the KPIs count what they say they count", () => {
  const items = computeWaves([
    it("A", [], { pri: "P0", size: "S" }),
    it("B", [], { pri: "P0", size: "S" }),
    it("C", [], { pri: "P2", size: "S" }),
    it("D", ["A", "B", "C"], { pri: "P1", size: "L" }),
  ]);
  const k = kpis(items);
  assert.equal(k.items, 4);
  assert.equal(k.waves, 2, "wave 0 and wave 1");
  assert.equal(k.p0, 2);
  assert.equal(k.maxParallel, 3, "A, B and C can all run at once");
  assert.equal(k.days, 6, "0.5 × 3 + 4, rounded");
  assert.deepEqual(k.criticalPath, ["A", "D"]);
});

test("pick-up order is wave, then priority, then serial", () => {
  const items = computeWaves([
    it("AB-003", [], { pri: "P2" }),
    it("AB-001", [], { pri: "P1" }),
    it("AB-002", [], { pri: "P0" }),
    it("AB-004", ["AB-002"], { pri: "P0" }),
  ]);
  assert.deepEqual(
    ordered(items).map((i) => i.id),
    ["AB-002", "AB-001", "AB-003", "AB-004"],
  );
});

test("a serial is never reused, even after the item is gone", () => {
  // ⛔ AB-002 was dropped. The next item is AB-004, not AB-002 — a PR that
  // closed AB-002 must keep meaning what it meant.
  assert.equal(nextSerial([it("AB-001"), it("AB-003")], "AB"), "AB-004");
  assert.equal(nextSerial([], "AB"), "AB-001");
});

test("⛔ readyWave returns ONE wave, never the whole backlog", () => {
  // Vivek: "run only one wave per execution but that one wave will kickoff
  // parallel execution paths." The parallelism is inside the wave.
  const items = computeWaves([
    it("A"),
    it("B"),
    it("C", ["A"]),
    it("D", ["B"]),
  ]);
  const first = readyWave(items, []);
  assert.equal(first.wave, 0);
  assert.deepEqual(
    first.items.map((i) => i.id),
    ["A", "B"],
    "both wave-0 items, and neither of the wave-1 items",
  );
});

test("readyWave moves on only when the wave it was waiting on has completed", () => {
  const items = computeWaves([it("A"), it("B"), it("C", ["A", "B"])]);

  assert.deepEqual(
    readyWave(items, ["A"]).items.map((i) => i.id),
    ["B"],
    "C is still blocked on B",
  );
  assert.deepEqual(
    readyWave(items, ["A", "B"]).items.map((i) => i.id),
    ["C"],
  );
  assert.deepEqual(readyWave(items, ["A", "B", "C"]).items, [], "nothing left");
});
