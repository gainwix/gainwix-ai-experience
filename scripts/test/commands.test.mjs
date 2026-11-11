// The commands are prose, so most of what they say cannot be tested. What can
// be: every plugin file they tell the model to read, run or copy is there.
//
// ⛔ `/gx-about` writes ABOUT.md from `templates/scaffold/ABOUT.md`. When that
// file moves, nothing errors — the model just improvises a document instead.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const PLUGIN = new URL("../../", import.meta.url);

function prose() {
  const out = [];
  for (const dir of ["commands/", "agents/"]) {
    const base = new URL(dir, PLUGIN);
    for (const f of fs.readdirSync(base).filter((f) => f.endsWith(".md"))) {
      out.push([`${dir}${f}`, fs.readFileSync(new URL(f, base), "utf8")]);
    }
  }
  return out;
}

test("every ${CLAUDE_PLUGIN_ROOT} path a command or agent names exists", () => {
  const named = [];
  for (const [file, body] of prose()) {
    for (const m of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]*)/g)) {
      named.push([file, m[1]]);
    }
  }
  assert.ok(named.length > 0, "the commands name plugin files somewhere");
  for (const [file, rel] of named) {
    assert.ok(
      fs.existsSync(fileURLToPath(new URL(rel, PLUGIN))),
      `${file} names \${CLAUDE_PLUGIN_ROOT}/${rel}, which does not exist`,
    );
  }
});

test("⛔ /gx-about writes ABOUT.md from a template that is there", () => {
  const about = fs.readFileSync(new URL("commands/gx-about.md", PLUGIN), "utf8");
  assert.match(about, /\$\{CLAUDE_PLUGIN_ROOT\}\/templates\/scaffold\/ABOUT\.md/);
  const template = fs.readFileSync(new URL("templates/scaffold/ABOUT.md", PLUGIN), "utf8");
  // Step 4 runs this section, and Step 0 recognises an untouched template by
  // its placeholders.
  assert.match(template, /## Prompt — Generate Features From This Document/);
  assert.match(template, /<[A-Z][^>]*>/, "the template still has placeholders to fill");
});
