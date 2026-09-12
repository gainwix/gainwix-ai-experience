// Render → parse → compare.
//
// ⭐ **This is what makes "the HTML is the source of truth" safe to say.** If a
// render loses a field, the next command reads a model with a hole in it and
// writes that hole back — quietly, and forever. The only defence is proving the
// journey is lossless, every time.

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeWaves } from "../graph.mjs";
import { parseItems, parseMeta } from "../parse.mjs";
import { render } from "../render.mjs";

const META = {
  component: "admin",
  prefix: "AB",
  stage: "backlog",
  source: "Spec 001",
  generated: "2026-09-12",
};

/** One of everything: deps, no deps, every priority and size, links, punctuation. */
const ITEMS = computeWaves([
  {
    id: "AB-001",
    title: "Resolve the open questions",
    detail: 'Get answers for Q1–Q8, or accept the "defaults" & record them.',
    spec: "Spec §21",
    deps: [],
    pri: "P0",
    size: "S",
    lane: "platform",
    pr: "A",
    status: "backlog",
    issue: "",
    prLink: "",
  },
  {
    id: "AB-002",
    title: "Devise compatibility spike",
    detail: "Add <devise> & bcrypt; boot the app.",
    spec: "Spec §4.3",
    deps: [],
    pri: "P0",
    size: "M",
    lane: "auth",
    pr: "A",
    status: "backlog",
    issue: "https://github.com/x/y/issues/12",
    prLink: "",
  },
  {
    id: "AB-003",
    title: "Admin model and migration",
    detail: "",
    spec: "",
    deps: ["AB-001", "AB-002"],
    pri: "P1",
    size: "L",
    lane: "auth",
    pr: "B",
    status: "in-progress",
    issue: "https://github.com/x/y/issues/13",
    prLink: "https://github.com/x/y/pull/44",
  },
  {
    id: "AB-004",
    title: "Login screen",
    detail: "Email, password, no sign-up link.",
    spec: "Spec §6.3",
    deps: ["AB-003"],
    pri: "P2",
    size: "S",
    lane: "auth",
    pr: "B",
    status: "backlog",
    issue: "",
    prLink: "",
  },
]);

test("every item survives render → parse unchanged", () => {
  const back = parseItems(render(ITEMS, META));
  assert.equal(back.length, ITEMS.length);
  for (const original of ITEMS) {
    const got = back.find((i) => i.id === original.id);
    assert.ok(got, `${original.id} did not survive the round trip`);
    for (const field of [
      "title",
      "detail",
      "spec",
      "pri",
      "size",
      "lane",
      "pr",
      "status",
      "issue",
      "prLink",
    ]) {
      assert.equal(
        got[field],
        original[field],
        `${original.id}.${field} changed: ${JSON.stringify(original[field])} → ${JSON.stringify(got[field])}`,
      );
    }
    assert.deepEqual(got.deps, original.deps, `${original.id}.deps changed`);
  }
});

test("the header facts survive too, so a re-render does not lose them", () => {
  assert.deepEqual(parseMeta(render(ITEMS, META)), META);
});

test("⚠ ampersands and angle brackets in a title do not break the file", () => {
  // A title containing markup is the classic way a generated page starts
  // silently eating rows.
  const nasty = computeWaves([
    {
      id: "X-001",
      title: 'Fix <script> & "quotes" in <the> title',
      detail: "a > b && c < d",
      spec: "",
      deps: [],
      pri: "P0",
      size: "S",
      lane: "",
      pr: "",
      status: "backlog",
      issue: "",
      prLink: "",
    },
  ]);
  const back = parseItems(render(nasty, { ...META, prefix: "X" }));
  assert.equal(back.length, 1);
  assert.equal(back[0].title, 'Fix <script> & "quotes" in <the> title');
  assert.equal(back[0].detail, "a > b && c < d");
});

test("the waves on the page are the computed ones, recomputed on re-parse", () => {
  // The page carries data-wave, but parse deliberately ignores it and the graph
  // recomputes. A hand-edited wave cannot survive a round trip.
  const html = render(ITEMS, META);
  const reparsed = computeWaves(parseItems(html));
  for (const i of ITEMS) {
    assert.equal(reparsed.find((r) => r.id === i.id).wave, i.wave);
  }
});

test("an empty backlog renders a page rather than a broken one", () => {
  const html = render([], META);
  assert.match(html, /Nothing here yet/);
  assert.deepEqual(parseItems(html), []);
});

test("no external dependencies — nothing is fetched", () => {
  // ⛔ Vivek's email: "this uses inline css, html and javascript - no external
  // dependencies." A file that needs the network is not openable from a
  // checkout on a plane.
  const html = render(ITEMS, META);
  assert.doesNotMatch(html, /<script[^>]+src=/i, "an external script");
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i, "an external stylesheet");
  assert.doesNotMatch(html, /@import/i, "a CSS import");
  assert.doesNotMatch(html, /https?:\/\/(?!github\.com)/i, "an off-site URL");
});
