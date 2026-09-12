// Rendering a component's backlog to one self-contained HTML file.
//
// ⛔ **Inline CSS, HTML and JavaScript. No external dependencies.** Vivek's
// email says so, and it is what makes the file openable from a checkout, over
// a share, or on a machine with no network.
//
// ⭐ **The page is a VIEW.** Waves, the KPIs and the critical path are computed
// in `graph.mjs` and baked in here as facts. The JavaScript on the page does
// filtering and highlighting only — it never re-derives the order, so what a
// person sees is what the tool decided.
//
// ⚠ Every fact this file needs to be read back lives in `data-` attributes on
// the rows, so `parse.mjs` can recover the model exactly. There is a test that
// renders, re-parses and compares.

import { criticalPath, kpis, ordered } from "./graph.mjs";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Stages, and what each file is for. */
export const STAGES = {
  backlog: {
    title: "Backlog",
    blurb:
      "Everything still to do, in dependency order. Items in one wave never depend on each other, so they can be worked at the same time.",
  },
  "in-progress": {
    title: "In progress",
    blurb:
      "Only what is being worked on right now. This file is transient — an item arrives when it is picked up and leaves when it merges.",
  },
  completed: {
    title: "Completed",
    blurb: "Work that landed, with the PR that landed it.",
  },
};

const STYLE = `
:root{
  --ink:#12181f; --ink-2:#39434f; --faint:#6b7683; --line:#e2e7ec;
  --paper:#fff; --paper-2:#f6f8fa; --paper-3:#eef2f6;
  --brand:#3d5afe; --brand-soft:#eef1ff;
  --ok:#1f7a4d; --ok-bg:#e6f5ed; --warn:#8a5a12; --warn-bg:#fdf3e0;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper-2);color:var(--ink);
  font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--brand)}
.wrap{max-width:1240px;margin:0 auto;padding:28px 24px 80px}
h1{font-size:26px;margin:0 0 6px}
.sub{color:var(--ink-2);max-width:760px;margin:0 0 4px}
.meta{color:var(--faint);font-size:13px;margin:10px 0 0}
.meta b{color:var(--ink-2);font-weight:600}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:22px 0 6px}
.kpi{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:11px 13px}
.kpi b{display:block;font-size:24px;font-weight:700}
.kpi span{font-size:12px;color:var(--faint)}
.note{background:var(--paper);border:1px solid var(--line);border-left:3px solid var(--brand);
  border-radius:0 10px 10px 0;padding:12px 15px;margin:16px 0;font-size:13.5px;color:var(--ink-2)}
.note b{color:var(--ink)}
h2{font-size:18px;margin:34px 0 10px;padding-top:12px;border-top:2px solid var(--brand);display:inline-block}
.filters{display:flex;flex-wrap:wrap;gap:9px;align-items:center;background:var(--paper);
  border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin:12px 0;
  position:sticky;top:0;z-index:9}
.filters input,.filters select{font:inherit;font-size:13.5px;padding:7px 9px;
  border:1px solid var(--line);border-radius:8px;background:#fff}
.filters input{flex:1;min-width:190px}
.filters button{font:600 13px inherit;padding:7px 11px;border-radius:8px;
  border:1px solid var(--line);background:var(--paper-3);cursor:pointer}
.count{margin-left:auto;font-size:13px;color:var(--faint)}
.wave{display:grid;grid-template-columns:158px 1fr;gap:12px;background:var(--paper);
  border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px}
.wh{font-weight:700;font-size:13px}
.wh small{display:block;font-weight:400;font-size:11.5px;color:var(--faint);margin-top:2px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12px;border:1px solid var(--line);border-radius:8px;padding:5px 8px;
  background:#fff;cursor:pointer;max-width:265px;display:flex;gap:6px;align-items:flex-start}
.chip .id{font:700 11px var(--mono);color:var(--brand);white-space:nowrap}
.chip.sel{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.chip.up,tr.up td{background:var(--warn-bg)}
.chip.down,tr.down td{background:var(--ok-bg)}
.chip.dim,tr.dim td{opacity:.35}
.chip.hidden,tr.hidden{display:none}
.tbl{overflow-x:auto;background:var(--paper);border:1px solid var(--line);border-radius:12px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{padding:9px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
th{background:var(--paper-3);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2)}
tr:last-child td{border-bottom:0}
tr.sel td{background:var(--brand-soft)}
td.id{font:700 12.5px var(--mono);color:var(--brand);white-space:nowrap}
td .t{font-weight:600;display:block}
td .d{color:var(--faint);font-size:13px;display:block;margin-top:2px}
td .s,td .lnk{font-size:12px;display:block;margin-top:3px;color:var(--faint)}
td .lnk a{margin-right:8px}
td.c{text-align:center;white-space:nowrap}
.pri{display:inline-block;font:700 10.5px inherit;border-radius:5px;padding:2px 6px}
.P0{background:var(--ink);color:#fff}.P1{background:var(--brand);color:#fff}
.P2{background:var(--paper-3);color:var(--faint);border:1px solid var(--line)}
.size,.tag{display:inline-block;font:600 11.5px var(--mono);border:1px solid var(--line);
  border-radius:5px;padding:1px 6px;background:#fff}
.tag{font-family:inherit;border-radius:999px;background:var(--paper-3)}
.dep{display:inline-block;font:600 11.5px var(--mono);color:var(--brand);background:#fff;
  border:1px solid var(--line);border-radius:5px;padding:0 5px;margin:1px 3px 1px 0;cursor:pointer}
.path{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font:12.5px var(--mono);margin:8px 0}
.path .n{background:var(--ink);color:#fff;border-radius:6px;padding:3px 7px;cursor:pointer}
.path .a{color:var(--faint)}
.empty{background:var(--paper);border:1px dashed var(--line);border-radius:12px;
  padding:26px;text-align:center;color:var(--faint)}
@media (max-width:900px){.kpis{grid-template-columns:repeat(3,1fr)}.wave{grid-template-columns:1fr}
  .filters{position:static}}
@media print{.filters{display:none}body{background:#fff}}
`.trim();

const SCRIPT = `
(function(){
  var rows = [].slice.call(document.querySelectorAll('tr[data-id]'));
  var chips = [].slice.call(document.querySelectorAll('.chip[data-id]'));
  var byId = {};
  rows.forEach(function(r){ byId[r.dataset.id] = { row:r, chip:null,
    deps:(r.dataset.deps||'').split(/\\s+/).filter(Boolean), dependents:[] }; });
  chips.forEach(function(c){ if(byId[c.dataset.id]) byId[c.dataset.id].chip = c; });
  Object.keys(byId).forEach(function(id){
    byId[id].deps.forEach(function(d){ if(byId[d]) byId[d].dependents.push(id); });
  });

  var selected = null;
  function walk(id, key, acc){
    byId[id][key].forEach(function(n){ if(!acc[n]){ acc[n]=1; walk(n,key,acc); } });
    return acc;
  }
  function paint(id){
    if(selected === id){ clear(); return; }
    selected = id;
    var up = walk(id,'deps',{}), down = walk(id,'dependents',{});
    Object.keys(byId).forEach(function(k){
      var cls = k===id ? 'sel' : up[k] ? 'up' : down[k] ? 'down' : 'dim';
      [byId[k].row, byId[k].chip].forEach(function(el){
        if(!el) return;
        el.classList.remove('sel','up','down','dim');
        el.classList.add(cls);
      });
    });
    document.getElementById('count').textContent =
      id + ': waits on ' + Object.keys(up).length + ', unblocks ' + Object.keys(down).length;
  }
  function clear(){
    selected = null;
    Object.keys(byId).forEach(function(k){
      [byId[k].row, byId[k].chip].forEach(function(el){
        if(el) el.classList.remove('sel','up','down','dim');
      });
    });
    filter();
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest('.chip,.dep,td.id,.path .n');
    if(!t) return;
    var id = t.dataset.id || t.textContent.trim();
    if(byId[id]) paint(id);
  });
  var clr = document.getElementById('clear');
  if(clr) clr.addEventListener('click', clear);

  var q = document.getElementById('q'), fw = document.getElementById('f-wave'),
      fp = document.getElementById('f-pri'), fl = document.getElementById('f-lane');
  function filter(){
    var v = (q.value||'').trim().toLowerCase(), n = 0;
    rows.forEach(function(r){
      var hit = (!v || (r.dataset.id + ' ' + r.textContent).toLowerCase().indexOf(v) > -1)
        && (!fw.value || r.dataset.wave === fw.value)
        && (!fp.value || r.dataset.pri === fp.value)
        && (!fl.value || r.dataset.lane === fl.value);
      r.classList.toggle('hidden', !hit);
      var c = byId[r.dataset.id].chip;
      if(c) c.classList.toggle('hidden', !hit);
      if(hit) n++;
    });
    [].slice.call(document.querySelectorAll('.wave')).forEach(function(w){
      w.style.display = w.querySelector('.chip:not(.hidden)') ? '' : 'none';
    });
    if(!selected) document.getElementById('count').textContent = n + ' of ' + rows.length + ' items';
  }
  [q,fw,fp,fl].forEach(function(el){ el.addEventListener('input',filter); el.addEventListener('change',filter); });
  filter();
})();
`.trim();

function row(i) {
  const dep = (d) => `<span class="dep" data-id="${esc(d)}">${esc(d)}</span>`;
  const link = (href, label, text) =>
    href
      ? ` <a href="${esc(href)}" data-link="${label}" target="_blank" rel="noreferrer">${text}</a>`
      : "";
  return `<tr data-id="${esc(i.id)}" data-wave="${i.wave}" data-pri="${esc(i.pri)}" data-size="${esc(i.size)}" data-lane="${esc(i.lane)}" data-pr="${esc(i.pr)}" data-status="${esc(i.status)}" data-deps="${esc(i.deps.join(" "))}">
<td class="id">${esc(i.id)}</td>
<td><span class="t">${esc(i.title)}</span>${i.detail ? `<span class="d">${esc(i.detail)}</span>` : ""}${i.spec ? `<span class="s">${esc(i.spec)}</span>` : ""}${
    // ⚠ Links live in their OWN span. Rendering them inside the spec span made
    // the word "issue" part of the spec text on the way back in — caught by the
    // round-trip test, which is exactly the silent corruption it exists for.
    i.issue || i.prLink
      ? `<span class="lnk">${link(i.issue, "issue", "issue")}${link(i.prLink, "pr", "PR")}</span>`
      : ""
  }</td>
<td>${i.lane ? `<span class="tag">${esc(i.lane)}</span>` : ""}</td>
<td class="c">${i.pr ? `<span class="tag">${esc(i.pr)}</span>` : ""}</td>
<td class="c"><span class="pri ${esc(i.pri)}">${esc(i.pri)}</span></td>
<td class="c"><span class="size">${esc(i.size)}</span></td>
<td class="c">${i.wave}</td>
<td>${i.deps.length ? i.deps.map(dep).join("") : "—"}</td>
</tr>`;
}

/**
 * The whole file, from the model.
 *
 * ⚠ `items` must already have waves — call `computeWaves` first. Rendering
 * does not compute, so a stale wave cannot sneak on to the page.
 */
export function render(items, meta) {
  const stage = STAGES[meta.stage] ?? STAGES.backlog;
  const list = ordered(items);
  const k = kpis(items);
  const cp = criticalPath(items);
  const lanes = [...new Set(items.map((i) => i.lane).filter(Boolean))].sort();
  const waves = k.waves;

  const board = Array.from({ length: waves }, (_, w) => {
    const inWave = list.filter((i) => i.wave === w);
    const days = inWave.reduce(
      (a, i) => Math.max(a, { S: 0.5, M: 1.5, L: 4 }[i.size] ?? 0),
      0,
    );
    return `<div class="wave" data-wave="${w}">
<div class="wh">Wave ${w}<small>${inWave.length} item${inWave.length === 1 ? "" : "s"} in parallel</small><small>≈${days} day${days === 1 ? "" : "s"} if fully parallel</small></div>
<div class="chips">${inWave
      .map(
        (i) =>
          `<div class="chip" data-id="${esc(i.id)}" title="${esc(i.size)} · ${esc(i.lane)}${i.deps.length ? " · after " + esc(i.deps.join(", ")) : " · no dependencies"}"><span class="id">${esc(i.id)}</span><span>${esc(i.title)}</span></div>`,
      )
      .join("")}</div></div>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.component)} — ${stage.title}</title>
<meta name="gx-component" content="${esc(meta.component)}">
<meta name="gx-prefix" content="${esc(meta.prefix)}">
<meta name="gx-stage" content="${esc(meta.stage)}">
<meta name="gx-source" content="${esc(meta.source ?? "")}">
<meta name="gx-generated" content="${esc(meta.generated ?? new Date().toISOString().slice(0, 10))}">
<style>${STYLE}</style>
</head><body><div class="wrap">

<h1>${esc(meta.component)} — ${stage.title}</h1>
<p class="sub">${stage.blurb}</p>
<p class="meta"><b>Serial prefix</b> ${esc(meta.prefix)}- · <b>Generated</b> ${esc(meta.generated ?? new Date().toISOString().slice(0, 10))}${meta.source ? ` · <b>From</b> ${esc(meta.source)}` : ""}</p>

<div class="note"><b>This file is managed by the GainWix tools. Do not edit it by hand.</b>
Sequence comes only from <b>Depends on</b> — nothing else orders the work. A wave number is the
length of the longest dependency chain behind an item, so items in one wave never depend on each
other and can be worked at the same time. Serials are permanent and never reused.</div>

${
  items.length === 0
    ? `<div class="empty">Nothing here yet.</div>`
    : `<div class="kpis">
<div class="kpi"><b>${k.items}</b><span>items</span></div>
<div class="kpi"><b>${k.waves}</b><span>waves</span></div>
<div class="kpi"><b>${k.p0}</b><span>P0 must-haves</span></div>
<div class="kpi"><b>${k.maxParallel}</b><span>max in parallel</span></div>
<div class="kpi"><b>≈${k.days}</b><span>engineer-days</span></div>
<div class="kpi"><b>${k.criticalPath.length}</b><span>on the critical path</span></div>
</div>

<h2>Critical path</h2>
<div class="path">${cp.path.map((id) => `<span class="n" data-id="${esc(id)}">${esc(id)}</span>`).join('<span class="a">→</span>')}</div>
<p class="meta">${cp.path.length} items, ≈${k.criticalDays} days end to end however many people are on it. Total work ≈${k.days} days, so about <b>${k.parallelism}×</b> parallelism is available.</p>

<h2>Waves</h2>
<div class="filters">
<input id="q" type="search" placeholder="Filter by serial, title or keyword…" aria-label="Filter">
<select id="f-wave" aria-label="Wave"><option value="">All waves</option>${Array.from({ length: waves }, (_, w) => `<option value="${w}">Wave ${w}</option>`).join("")}</select>
<select id="f-pri" aria-label="Priority"><option value="">All priorities</option><option>P0</option><option>P1</option><option>P2</option></select>
<select id="f-lane" aria-label="Lane"><option value="">All lanes</option>${lanes.map((l) => `<option>${esc(l)}</option>`).join("")}</select>
<button id="clear" type="button">Clear selection</button>
<span class="count" id="count"></span>
</div>
${board}

<h2>Items</h2>
<div class="tbl"><table>
<thead><tr><th>#</th><th>Item</th><th>Lane</th><th>PR</th><th>Pri</th><th>Size</th><th>Wave</th><th>Depends on</th></tr></thead>
<tbody>
${list.map(row).join("\n")}
</tbody></table></div>

<script>${SCRIPT}</script>`
}
</div></body></html>`;
}
