/* Octaspan Live Threat Snapshot: "Attack types" detail window. Reads the loaded snapshot (attackDetails) and,
   when the Supabase archive is on, adds a 12-month trend for the selected type. Charts are inline SVG. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? esc(u) : '#');
  const SEV = { critical: ['Critical', '#f0524f'], high: ['High', '#ff8a4c'], medium: ['Medium', '#f5a524'], low: ['Low', '#2fc27a'], info: ['Info', '#3b82f6'] };
  const VER = { confirmed: ['Confirmed', '#2fc27a'], reported: ['Reported', '#3b82f6'], claimed: ['Unconfirmed claim', '#f5a524'] };
  const ago = (ts) => { const m = Math.max(0, Math.round((Date.now() - ts) / 60000)); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); return h < 48 ? h + ' h ago' : Math.round(h / 24) + ' d ago'; };
  let root, current, opener, hist = null, histTried = false;

  function ensure() {
    if (root) return;
    root = document.createElement('div'); root.className = 'atk-overlay'; root.hidden = true;
    root.innerHTML = '<div class="atk-dialog" role="dialog" aria-modal="true" aria-labelledby="atkTitle"><div class="atk-top"><h2 id="atkTitle">Attack types in detail</h2><button type="button" class="atk-x" aria-label="Close">&times;</button></div><div class="atk-body"><nav class="atk-list" id="atkList" aria-label="Attack types"></nav><div class="atk-main" id="atkMain" tabindex="-1"></div></div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', (e) => { if (e.target === root || e.target.closest('.atk-x')) close(); });
    document.addEventListener('keydown', (e) => {
      if (root.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') { const f = [...root.querySelectorAll('button,a[href],[tabindex="0"]')].filter((x) => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
  }

  async function loadHistory() {
    if (histTried) return; histTried = true;
    if (window.OctaspanHistoryRows) { hist = window.OctaspanHistoryRows; return; }
    try { const j = await (await fetch('/api/threat/history?days=400')).json(); if (j && j.enabled) hist = j.rows || []; } catch (e) {}
  }

  function open(id, from) {
    const T = window.OctaspanThreat, snap = T && T.snap(); if (!snap || !snap.attackDetails) return;
    ensure(); opener = from || document.activeElement;
    root.hidden = false; document.body.classList.add('atk-lock');
    const ids = Object.keys(snap.attackDetails);
    select(id && snap.attackDetails[id] ? id : ids[0]);
    root.querySelector('.atk-x').focus();
    loadHistory().then(() => { if (!root.hidden) renderMain(); });
  }
  function close() { root.hidden = true; document.body.classList.remove('atk-lock'); if (opener && opener.focus) opener.focus(); }

  function select(id, keepFocus) { current = id; renderList(); renderMain(); if (keepFocus) { const b = $('atkList').querySelector('[aria-current="true"]'); if (b) b.focus(); } }

  function renderList() {
    const snap = window.OctaspanThreat.snap(), D = snap.attackDetails, ids = Object.keys(D), max = Math.max(1, ...ids.map((i) => D[i].associated));
    $('atkList').innerHTML = ids.map((i, n) => '<button type="button" data-id="' + esc(i) + '" aria-current="' + (i === current) + '"><i style="background:' + window.OctaspanThreat.colors[n % window.OctaspanThreat.colors.length] + '"></i><span>' + esc(D[i].label) + '</span><b>' + D[i].primary + '</b><em style="width:' + Math.round(D[i].associated / max * 100) + '%"></em></button>').join('');
    $('atkList').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => select(b.dataset.id, true)));
  }

  const bars = (rows, color, total) => rows.length ? '<ul class="atk-bars">' + rows.map((r) => '<li><span>' + esc(r.label) + '</span><i><u style="width:' + Math.max(3, Math.round(r.n / Math.max(1, rows[0].n) * 100)) + '%;background:' + color + '"></u></i><b>' + r.n + '</b></li>').join('') + '</ul>' : '<p class="atk-none">Not stated in the sources.</p>';
  const stack = (rows, map) => { const t = rows.reduce((n, r) => n + r.n, 0); if (!t) return '<p class="atk-none">No data.</p>'; return '<div class="atk-stack" role="img" aria-label="' + esc(rows.map((r) => map[r.id][0] + ' ' + r.n).join(', ')) + '">' + rows.filter((r) => r.n).map((r) => '<span style="width:' + (r.n / t * 100) + '%;background:' + map[r.id][1] + '" title="' + esc(map[r.id][0] + ': ' + r.n) + '"></span>').join('') + '</div><ul class="atk-key">' + rows.map((r) => '<li><i style="background:' + map[r.id][1] + '"></i>' + map[r.id][0] + ' <b>' + r.n + '</b></li>').join('') + '</ul>'; };

  function spark(points, labelFn, color, h) {
    const W = 520, H = h || 120, L = 26, B = 22, T = 8, pw = W - L - 4, ph = H - T - B, max = Math.max(1, ...points.map((p) => p.n)), bw = pw / points.length, g = Math.min(4, bw * .2);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="atk-svg" role="img" aria-label="' + esc(points.map((p) => labelFn(p) + ': ' + p.n).join('; ')) + '">';
    [0, .5, 1].forEach((f) => { const y = T + ph - f * ph; s += '<line x1="' + L + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" stroke="#1c3961"/><text x="' + (L - 5) + '" y="' + (y + 4) + '" text-anchor="end" fill="#9bb0cf" font-size="10">' + Math.round(max * f) + '</text>'; });
    const every = Math.ceil(points.length / 6);
    points.forEach((p, i) => { const h2 = p.n / max * ph, x = L + i * bw + g / 2; s += '<g><title>' + esc(labelFn(p) + ': ' + p.n) + '</title><rect x="' + x.toFixed(1) + '" y="' + (T + ph - h2).toFixed(1) + '" width="' + Math.max(2, bw - g).toFixed(1) + '" height="' + Math.max(p.n ? 1 : 0, h2).toFixed(1) + '" rx="1.5" fill="' + color + '"/></g>'; if (i % every === 0) s += '<text x="' + (x + (bw - g) / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" fill="#9bb0cf" font-size="10">' + esc(labelFn(p, true)) + '</text>'; });
    return s + '</svg>';
  }

  function monthly(id) {
    if (!hist || !hist.length) return '';
    const m = new Map(); const now = new Date(), start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1);
    for (let i = 0; i < 12; i++) { const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1); m.set(d, 0); }
    hist.forEach((r) => { if (r.primary_attack !== id) return; const t = Date.parse(r.day + 'T00:00:00Z'); if (t < start) return; const k = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), 1); m.set(k, (m.get(k) || 0) + r.reports); });
    const pts = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, n]) => ({ t, n }));
    if (!pts.some((p) => p.n)) return '';
    return '<section class="atk-card"><h3>12-month trend <span>reports, archived</span></h3>' + spark(pts, (p, short) => new Date(p.t).toLocaleDateString(undefined, short ? { month: 'short', timeZone: 'UTC' } : { month: 'long', year: 'numeric', timeZone: 'UTC' }), '#8b7cf6') + '<p class="atk-note">Counts publications whose primary type is this one. The first and latest months may be partial.</p></section>';
  }

  function renderMain() {
    const T = window.OctaspanThreat, snap = T.snap(), d = snap.attackDetails[current]; if (!d) return;
    const total = Object.values(snap.attackDetails).reduce((n, x) => n + x.primary, 0) || 1;
    const w = snap.window, tl = (w === '24h') ? (p, s) => new Date(p.t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : (w === '72h') ? (p, s) => new Date(p.t).toLocaleString(undefined, s ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : (p) => new Date(p.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const chg = d.previous == null ? '<span class="atk-pill">Insufficient data to compare</span>' : (d.previous === 0 ? '<span class="atk-pill">No previous baseline</span>' : (() => { const c = Math.round((d.associated - d.previous) / d.previous * 100); return '<span class="atk-pill ' + (c > 0 ? 'up' : c < 0 ? 'down' : '') + '">' + (c > 0 ? '▲ ' : c < 0 ? '▼ ' : '● ') + Math.abs(c) + '% vs previous ' + esc(w) + '</span>'; })());
    let h = '<div class="atk-head"><div><h3>' + esc(d.label) + '</h3><p>' + d.primary + ' as primary type · ' + d.associated + ' including associated mentions · ' + Math.round(d.primary / total * 100) + '% of classified incidents</p></div>' + chg + '</div>' +
      '<div class="atk-grid">' +
      '<section class="atk-card"><h3>Activity over the last ' + esc(w) + ' <span>stories published</span></h3>' + spark(d.timeline, tl, '#29d3f0') + '</section>' +
      monthly(current) +
      '<section class="atk-card"><h3>Sectors affected</h3>' + bars(d.sectors, '#3b82f6') + '</section>' +
      '<section class="atk-card"><h3>Regions</h3>' + bars(d.regions, '#8b7cf6') + (d.countries.length ? '<h4>Countries named</h4>' + bars(d.countries, '#29d3f0') : '') + '</section>' +
      '<section class="atk-card"><h3>Severity</h3>' + stack(d.severities, SEV) + '</section>' +
      '<section class="atk-card"><h3>Verification</h3>' + stack(d.verifications, VER) + '</section>' +
      (d.cves.length || d.actors.length ? '<section class="atk-card"><h3>Named in the sources</h3>' + (d.actors.length ? '<h4>Threat actors</h4><p class="atk-chips">' + d.actors.map((a) => '<span>' + esc(a.label) + ' · ' + a.n + '</span>').join('') + '</p>' : '') + (d.cves.length ? '<h4>CVEs</h4><p class="atk-chips">' + d.cves.map((a) => '<a href="https://nvd.nist.gov/vuln/detail/' + encodeURIComponent(a.label) + '" target="_blank" rel="noopener noreferrer">' + esc(a.label) + ' ↗</a>').join('') + '</p>' : '') + '</section>' : '') +
      '</div>' +
      '<section class="atk-card atk-wide"><h3>Latest stories <span>click to read at the publisher</span></h3>' + (d.items.length ? '<ul class="atk-items">' + d.items.map((i) => '<li><a href="' + safeUrl(i.url) + '" target="_blank" rel="noopener noreferrer">' + esc(i.headline) + ' ↗</a><p>' + esc(i.excerpt || '') + '</p><span>' + esc(i.source) + ' · ' + esc(ago(i.publishedAt)) + (i.sector && i.sector !== 'Other / Unknown' ? ' · ' + esc(i.sector) : '') + (i.country ? ' · ' + esc(i.country) : '') + (i.severity ? ' · <b class="sv-' + esc(i.severity) + '">' + esc((SEV[i.severity] || [i.severity])[0]) + '</b>' : '') + (i.primary ? '' : ' · associated type') + (i.reportCount > 1 ? ' · ' + i.reportCount + ' outlets' : '') + '</span></li>').join('') + '</ul>' : '<p class="atk-none">No stories in this window.</p>') +
      '</section><div class="atk-actions"><button type="button" class="btn" id="atkFilter">Filter the live feed to ' + esc(d.label) + ' →</button><span>Counts cover the selected window and filters on the dashboard. Reports are summarised from public sources; follow the links for the original coverage.</span></div>';
    $('atkMain').innerHTML = h;
    $('atkFilter').addEventListener('click', () => { close(); T.filterBy('attack', current).then(() => { const f = $('feed'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); });
  }

  window.OctaspanAttack = { open, close };
  document.addEventListener('DOMContentLoaded', () => { const b = $('atkOpen'); if (b) b.addEventListener('click', () => open(null, b)); });
})();
