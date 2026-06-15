/**
 * qa/runner/report.mjs — renders the QA run report.
 *
 * Pure rendering: takes a `results` object and returns strings. No Playwright,
 * no network, no secrets. The HTML is fully self-contained (inline CSS + JS, no
 * CDN) so a single file renders anywhere. Screenshots are linked relatively from
 * the sibling `RUN-REPORT-<ts>/` folder.
 *
 * Secret-safety: this module only ever sees step *labels* (selectors + masked
 * values) and located errors — never resolved secret values. Keep it that way.
 */

const esc = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Machine-readable sidecar `/gx-qbugs` consumes (no HTML scraping). */
export function renderJson(results) {
  return JSON.stringify(results, null, 2) + '\n';
}

/** One newest-first line for qa/RUN-LOG.md. */
export function renderRunLogEntry(results) {
  const { ts, counts, elapsedHuman } = results;
  const mark = counts.failed === 0 ? '✅' : '❌';
  return (
    `- ${mark} [${ts}](RUN-REPORT-${ts}.html) — ${counts.passed}/${counts.total} passed ` +
    `(${counts.parallel} parallel · ${counts.serial} serial · ${counts.api} api), ${elapsedHuman}\n`
  );
}

function badge(mode) {
  const m = esc(mode);
  return `<span class="badge badge-${m}">${m}</span>`;
}

function whereLine(where) {
  if (!where) return '';
  const bits = [];
  if (where.step != null) bits.push(`step ${esc(where.step)}`);
  if (where.route) bits.push(`route <code>${esc(where.route)}</code>`);
  if (where.endpoint) bits.push(`endpoint <code>${esc(where.endpoint)}</code>`);
  if (where.httpStatus) bits.push(`HTTP ${esc(where.httpStatus)}`);
  if (where.surface) bits.push(`(${esc(where.surface)})`);
  return bits.length ? `<div class="where">WHERE: ${bits.join(' · ')}</div>` : '';
}

function workflowSection(wf, i) {
  const ok = wf.status === 'passed';
  const shots = (wf.screenshots || [])
    .map(
      (s) =>
        `<figure><img loading="lazy" src="${esc(s.path)}" alt="${esc(s.label)}">` +
        `<figcaption>${esc(s.label)}</figcaption></figure>`,
    )
    .join('\n');
  const tested = (wf.tested || []).map((t) => `<li>${esc(t)}</li>`).join('');
  const err = wf.error
    ? `<div class="err"><strong>Error:</strong> ${esc(wf.error.message)}` +
      whereLine(wf.error.where) +
      `</div>`
    : '';
  return `
  <section class="wf ${ok ? 'pass' : 'fail'}" data-page="${i}">
    <h2>${ok ? '✓' : '✗'} ${esc(wf.name)} ${badge(wf.mode)}
      <span class="route">${esc(wf.route || '')}</span></h2>
    ${err}
    ${tested ? `<details open><summary>What was tested</summary><ul>${tested}</ul></details>` : ''}
    ${shots ? `<div class="shots">${shots}</div>` : ''}
  </section>`;
}

export function renderHtml(results) {
  const { ts, counts } = results;
  const rows = results.workflows
    .map(
      (w) =>
        `<tr class="${w.status}"><td>${w.status === 'passed' ? '✓' : '✗'}</td>` +
        `<td>${esc(w.name)}</td><td>${badge(w.mode)}</td>` +
        `<td><code>${esc(w.route || '')}</code></td></tr>`,
    )
    .join('\n');
  const sections = results.workflows.map(workflowSection).join('\n');
  const paginate = results.workflows.length > 2;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA Run ${esc(ts)} — ${counts.passed}/${counts.total} passed</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 1.5rem; max-width: 1100px; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .sub { color: #888; margin: 0 0 1rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { text-align: left; padding: .35rem .6rem; border-bottom: 1px solid #8883; }
  tr.failed { background: #ff000010; }
  .badge { font-size: .7rem; padding: .1rem .4rem; border-radius: .4rem; border: 1px solid #8886; }
  .badge-parallel { background: #3b82f615; } .badge-serial { background: #88888815; }
  .badge-api { background: #a855f715; }
  .wf { border: 1px solid #8883; border-radius: .6rem; padding: 1rem; margin: 1rem 0; }
  .wf.fail { border-color: #ef4444; }
  .wf h2 { font-size: 1.05rem; margin: 0 0 .5rem; }
  .route { color: #888; font-weight: 400; font-size: .85rem; }
  .err { background: #ef444415; border-left: 3px solid #ef4444; padding: .5rem .75rem; margin: .5rem 0; border-radius: .3rem; }
  .where { font-size: .8rem; color: #b91c1c; margin-top: .3rem; }
  .shots { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: .75rem; }
  figure { margin: 0; max-width: 320px; }
  figure img { width: 100%; border: 1px solid #8884; border-radius: .4rem; cursor: zoom-in; }
  figcaption { font-size: .75rem; color: #888; margin-top: .2rem; }
  code { background: #8881; padding: .05rem .3rem; border-radius: .3rem; }
  #pager { margin: 1rem 0; display: ${paginate ? 'flex' : 'none'}; gap: .5rem; align-items: center; }
  button { font: inherit; padding: .3rem .7rem; border-radius: .4rem; border: 1px solid #8886; cursor: pointer; }
</style></head>
<body>
  <h1>QA Run — ${counts.passed}/${counts.total} passed ${counts.failed ? '❌' : '✅'}</h1>
  <p class="sub">${esc(ts)} · ${esc(results.elapsedHuman)} · ${counts.parallel} parallel · ${counts.serial} serial · ${counts.api} api · base <code>${esc(results.baseUrl || '')}</code></p>
  <table><thead><tr><th></th><th>Workflow</th><th>Mode</th><th>Route</th></tr></thead><tbody>${rows}</tbody></table>
  <div id="pager"><button id="prev">‹ Prev</button><span id="pageinfo"></span><button id="next">Next ›</button></div>
  ${sections}
  <script>
    (function () {
      var paginate = ${paginate ? 'true' : 'false'};
      if (!paginate) return;
      var secs = Array.prototype.slice.call(document.querySelectorAll('.wf'));
      var per = 2, page = 0, pages = Math.ceil(secs.length / per);
      function render() {
        secs.forEach(function (s, i) { s.style.display = (i >= page * per && i < (page + 1) * per) ? '' : 'none'; });
        document.getElementById('pageinfo').textContent = 'Page ' + (page + 1) + ' / ' + pages;
        document.getElementById('prev').disabled = page === 0;
        document.getElementById('next').disabled = page >= pages - 1;
      }
      document.getElementById('prev').onclick = function () { if (page > 0) { page--; render(); } };
      document.getElementById('next').onclick = function () { if (page < pages - 1) { page++; render(); } };
      render();
    })();
  </script>
</body></html>
`;
}
