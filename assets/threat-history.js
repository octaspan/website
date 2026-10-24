/* Octaspan Live Threat Snapshot: long-term trends from the Supabase archive (/api/threat/history).
   Counts REPORTS (publications), not de-duplicated incidents, so it measures coverage, not attack frequency. */
(function () {
  'use strict';
  const API = '/api/threat/history?days=400';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#3b82f6', '#f0524f', '#f5a524', '#8b7cf6', '#29d3f0', '#2fc27a', '#ec6fb0', '#a3b6d6'];
  const LABEL = {
    sector: { bfsi: 'BFSI', govt: 'Government', health: 'Healthcare', energy: 'Energy & Critical Infra', mfg: 'Manufacturing', retail: 'Retail & FMCG', telecom: 'Telecommunications', tech: 'Technology & Cloud', edu: 'Education', other: 'Other / Unknown' },
    attack: { ransomware: 'Ransomware', apt: 'APT & Espionage', supply: 'Supply-chain', ai: 'AI & LLM attacks', breach: 'Data breach & exfiltration', vuln: 'Vulnerability exploitation', malware: 'Malware', phishing: 'Phishing & social engineering', cred: 'Credential theft & account compromise', ddos: 'DDoS', insider: 'Insider threat', other: 'Other / Unknown' },
  };
  const st = { range: 90, by: 'sector' };
  let rows = [];

  const DAY = 86400e3;
  const t = (d) => Date.parse(d + 'T00:00:00Z');
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const fmt = (ms, o) => new Date(ms).toLocaleDateString(undefined, Object.assign({ timeZone: 'UTC' }, o));
  const sum = (a, f) => a.reduce((n, r) => n + f(r), 0);

  function bucketStart(ms, monthly) {
    const d = new Date(ms);
    if (monthly) return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const dow = (d.getUTCDay() + 6) % 7; // Monday start
    return ms - dow * DAY;
  }

  function slice(from, to) { return rows.filter((r) => { const x = t(r.day); return x >= from && x < to; }); }

  async function load() {
    let j;
    try { const r = await fetch(API, { cache: 'no-cache' }); j = await r.json(); } catch (e) { return; }
    const panel = $('history'); if (!panel) return;
    if (!j || !j.enabled) { panel.hidden = true; return; } // archive not switched on: show nothing
    rows = Array.isArray(j.rows) ? j.rows : [];
    panel.hidden = false;
    render();
  }

  function render() {
    const body = $('histBody');
    if (!rows.length) { body.innerHTML = '<div class="empty">History is being collected. Trend charts appear here after the first few days of archived reports.</div>'; return; }
    const today = Date.now(), end = t(iso(today)) + DAY, start = end - st.range * DAY;
    const first = Math.min(...rows.map((r) => t(r.day)));
    const cur = slice(start, end), prev = slice(start - st.range * DAY, start);
    const total = sum(cur, (r) => r.reports);
    const daysCollected = Math.max(1, Math.round((end - first) / DAY));
    const covers = first <= start; // do we have the whole selected range?
    const monthly = st.range > 180;

    // buckets
    const key = st.by === 'sector' ? 'sector' : 'primary_attack';
    const totals = {}; cur.forEach((r) => { const k = r[key] || 'other'; totals[k] = (totals[k] || 0) + r.reports; });
    const top = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).slice(0, 6);
    const groups = top.concat(Object.keys(totals).length > 6 ? ['_rest'] : []);
    const buckets = new Map();
    for (let b = bucketStart(start, monthly); b < end; b = monthly ? Date.UTC(new Date(b).getUTCFullYear(), new Date(b).getUTCMonth() + 1, 1) : b + 7 * DAY) buckets.set(b, {});
    cur.forEach((r) => {
      const b = bucketStart(t(r.day), monthly), k = top.includes(r[key] || 'other') ? (r[key] || 'other') : '_rest';
      const o = buckets.get(b) || (buckets.set(b, {}), buckets.get(b)); o[k] = (o[k] || 0) + r.reports;
    });
    const list = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const peak = list.reduce((m, [b, o]) => { const n = sum(Object.values(o), (x) => x); return n > m.n ? { b, n } : m; }, { b: 0, n: 0 });

    const apt = sum(cur, (r) => r.apt_reports), expl = sum(cur, (r) => r.exploited_reports);
    const kpi = (h, v, d) => '<div class="kpi"><h3>' + h + '</h3><div class="v small">' + v + '</div><div class="d">' + d + '</div></div>';
    let html = '<div class="kpis hist-kpis">' +
      kpi('Reports archived', total.toLocaleString(), 'in the last ' + st.range + ' days') +
      kpi('Busiest ' + (monthly ? 'month' : 'week'), peak.n ? peak.n.toLocaleString() : '—', peak.n ? (monthly ? fmt(peak.b, { month: 'long', year: 'numeric' }) : 'week of ' + fmt(peak.b, { day: 'numeric', month: 'short' })) : '') +
      kpi('APT-related reports', apt.toLocaleString(), total ? Math.round(apt / total * 100) + '% of reports' : '') +
      kpi('Actively exploited', expl.toLocaleString(), total ? Math.round(expl / total * 100) + '% of reports' : '') + '</div>';
    if (!covers) html += '<p class="hint">The archive holds ' + daysCollected + ' day' + (daysCollected === 1 ? '' : 's') + ' of data so far (collection began ' + fmt(first, { day: 'numeric', month: 'short', year: 'numeric' }) + '), so this range is only partly filled.</p>';

    html += chart(list, groups, monthly) + '<p class="hint">The first and latest bars can cover only part of a ' + (monthly ? 'month' : 'week') + ', so they may look lower.</p>';
    html += legend(groups, totals);
    html += movers(cur, prev, covers && first <= start - st.range * DAY);
    html += '<details class="more"><summary>Show chart data as a table</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + (monthly ? 'Month' : 'Week starting') + '</th>' + groups.map((g) => '<th class="num">' + esc(name(g)) + '</th>').join('') + '<th class="num">Total</th></tr></thead><tbody>' +
      list.map(([b, o]) => '<tr><td>' + (monthly ? fmt(b, { month: 'short', year: 'numeric' }) : fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })) + '</td>' + groups.map((g) => '<td class="num">' + (o[g] || 0) + '</td>').join('') + '<td class="num">' + sum(Object.values(o), (x) => x) + '</td></tr>').join('') + '</tbody></table></div></details>';
    body.innerHTML = html;
  }

  const name = (g) => (g === '_rest' ? 'All other' : (LABEL[st.by][g] || g));

  function chart(list, groups, monthly) {
    const W = 720, H = 250, L = 38, R = 8, T = 10, B = 30, pw = W - L - R, ph = H - T - B;
    const maxV = Math.max(1, ...list.map(([, o]) => sum(Object.values(o), (x) => x)));
    const step = niceStep(maxV); const ymax = Math.ceil(maxV / step) * step;
    const bw = pw / Math.max(1, list.length), gap = Math.min(6, bw * 0.2);
    let s = '<svg class="hist-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Reports per ' + (monthly ? 'month' : 'week') + ', stacked by ' + (st.by === 'sector' ? 'sector' : 'attack type') + '. A data table is available below the chart.">';
    for (let v = 0; v <= ymax; v += step) {
      const y = T + ph - (v / ymax) * ph;
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#1c3961" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" fill="#9bb0cf" font-size="11">' + v + '</text>';
    }
    const every = Math.ceil(list.length / 8);
    list.forEach(([b, o], i) => {
      let y = T + ph; const x = L + i * bw + gap / 2, w = Math.max(2, bw - gap);
      const label = monthly ? fmt(b, { month: 'short' }) : fmt(b, { day: 'numeric', month: 'short' });
      const tip = label + ': ' + groups.map((g) => name(g) + ' ' + (o[g] || 0)).join(', ');
      s += '<g><title>' + esc(tip) + '</title>';
      groups.forEach((g, gi) => { const v = o[g] || 0; if (!v) return; const h = v / ymax * ph; y -= h; s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(0.5, h - 0.8).toFixed(1) + '" fill="' + (g === '_rest' ? '#5b6b8a' : COLORS[gi % COLORS.length]) + '" rx="1.5"/>'; });
      s += '</g>';
      if (i % every === 0) s += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" fill="#9bb0cf" font-size="11">' + esc(label) + '</text>';
    });
    return s + '</svg>';
  }
  function niceStep(max) { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }

  function legend(groups, totals) {
    return '<ul class="hist-legend">' + groups.map((g, i) => '<li><i style="background:' + (g === '_rest' ? '#5b6b8a' : COLORS[i % COLORS.length]) + '"></i>' + esc(name(g)) + '</li>').join('') + '</ul>';
  }

  function movers(cur, prev, comparable) {
    const key = 'primary_attack', a = {}, b = {};
    cur.forEach((r) => { const k = r[key] || 'other'; a[k] = (a[k] || 0) + r.reports; });
    prev.forEach((r) => { const k = r[key] || 'other'; b[k] = (b[k] || 0) + r.reports; });
    const ks = Object.keys(a).sort((x, y) => a[y] - a[x]).slice(0, 8);
    const prevTotal = sum(Object.values(b), (x) => x);
    let h = '<h3 class="hist-h3">Attack types vs the previous ' + st.range + ' days</h3>';
    if (!comparable || prevTotal < 20) return h + '<p class="hint">Insufficient history for a fair comparison: the previous ' + st.range + ' days need at least 20 archived reports.</p>';
    h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Attack type</th><th class="num">Now</th><th class="num">Before</th><th class="num">Change</th></tr></thead><tbody>' +
      ks.map((k) => { const n = a[k], p = b[k] || 0, d = p ? Math.round((n - p) / p * 100) : null; return '<tr><td>' + esc(LABEL.attack[k] || k) + '</td><td class="num">' + n + '</td><td class="num">' + p + '</td><td class="num ' + (d == null ? '' : d > 0 ? 'c up' : d < 0 ? 'c down' : '') + '">' + (d == null ? 'new' : (d > 0 ? '+' : '') + d + '%') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="hint">Changes reflect how much was <i>published</i>, which is influenced by news cycles and source coverage. They are not a measure of how many attacks happened.</p>';
    return h;
  }

  function bind() {
    document.querySelectorAll('#histRange button').forEach((b) => b.addEventListener('click', () => { st.range = +b.dataset.r; sync(); render(); }));
    document.querySelectorAll('#histBy button').forEach((b) => b.addEventListener('click', () => { st.by = b.dataset.by; sync(); render(); }));
    sync();
  }
  function sync() {
    document.querySelectorAll('#histRange button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.r === st.range)));
    document.querySelectorAll('#histBy button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.by === st.by)));
  }
  document.addEventListener('DOMContentLoaded', () => { bind(); load(); setInterval(load, 3 * 60 * 60 * 1000); });
})();
