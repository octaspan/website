/* Octaspan Live Threat Snapshot: renders /api/threat/snapshot. All figures come from the API; nothing is hardcoded. */
(function () {
  'use strict';
  const API = '/api/threat/snapshot', REFRESH_API = '/api/threat/refresh', AUTO_MS = 3 * 60 * 60 * 1000;
  const FILTERS = ['source', 'sector', 'attack', 'severity', 'country', 'verification'];
  const COLORS = ['#3b82f6', '#f0524f', '#f5a524', '#8b7cf6', '#29d3f0', '#2fc27a', '#ec6fb0', '#ff8a4c', '#7dd3a8', '#a3b6d6', '#5b6b8a', '#c9a227'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? esc(u) : '#');
  const sp = new URLSearchParams(location.search);
  const state = { window: ['24h', '72h', '7d', '30d'].includes(sp.get('window')) ? sp.get('window') : '72h' };
  FILTERS.forEach((k) => { if (sp.get(k)) state[k] = sp.get(k); });
  let snap = null, timer = null, optionsBuilt = false;

  const ago = (ts) => { if (!ts) return '—'; const m = Math.max(0, Math.round((Date.now() - ts) / 60000)); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 48) return h + ' h ago'; return Math.round(h / 24) + ' d ago'; };
  const when = (ts) => (ts ? new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const day = (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const money = (n, cur) => { try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch { return cur + ' ' + n; } };
  const VER = { confirmed: 'Confirmed', reported: 'Reported', claimed: 'Unconfirmed claim' };
  const KIND = { incident: 'Incident', campaign: 'Campaign / research', vulnerability: 'Vulnerability', advisory: 'Advisory', other: 'Other' };
  const SEV = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

  function query() { const p = new URLSearchParams(); p.set('window', state.window); FILTERS.forEach((k) => state[k] && p.set(k, state[k])); return p; }
  function syncUrl() { const p = query(); if (p.get('window') === '72h') p.delete('window'); const qs = p.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); }

  async function load(opts = {}) {
    syncUrl();
    if (!snap) { $('kpis').innerHTML = '<div class="skel"></div>'.repeat(6); $('feedList').innerHTML = '<div class="skel"></div>'.repeat(4); }
    try {
      const r = await fetch(API + '?' + query().toString(), { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      snap = await r.json();
      showBanner(null);
      render();
    } catch (e) {
      if (!snap) { renderEmptyError(); }
      showBanner('Could not load the latest data. ' + (snap ? 'Showing the last loaded results. ' : '') + 'Retrying automatically in a few minutes.', true);
      setStatus('error', 'Data unavailable');
      if (!opts.noRetry) setTimeout(() => load({ noRetry: true }), 60000);
    }
  }

  function showBanner(msg, isErr) { const b = $('banner'); if (!msg) { b.hidden = true; return; } b.hidden = false; b.className = 'banner' + (isErr ? ' err' : ''); b.textContent = msg; }
  function setStatus(cls, text) { $('status').className = 'status ' + cls; $('statusText').textContent = text; }
  function renderEmptyError() { $('kpis').innerHTML = ''; $('feedList').innerHTML = '<div class="empty">Live data is temporarily unavailable.</div>'; }

  function render() {
    const h = snap.health;
    // header + status derived from real ingestion health
    if (h.state === 'ok') setStatus('', 'Monitoring active');
    else if (h.state === 'stale') setStatus('stale', 'Data may be out of date');
    else setStatus('empty', 'Waiting for first data');
    $('lastUpdated').textContent = h.lastSuccessAt ? ago(h.lastSuccessAt) + ' (' + when(h.lastSuccessAt) + ')' : 'No successful ingestion yet';
    if (h.state === 'stale') showBanner('The last successful ingestion was ' + ago(h.lastSuccessAt) + '. Figures below may be out of date.');
    if (h.state === 'empty') showBanner('No reports have been ingested yet. The first scheduled ingestion runs within 3 hours of deployment; use Refresh to fetch now.');
    document.querySelectorAll('#windowSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.w === snap.window)));
    $('scopeNote').textContent = 'Showing reports published in the last ' + ({ '24h': '24 hours', '72h': '72 hours', '7d': '7 days', '30d': '30 days' }[snap.window]) + (activeFilters().length ? ' · filtered' : '') + '.';
    renderKpis(); renderSectors(); renderAttacks(); renderRegions(); renderTrends(); renderFinancial(); renderFeed(); renderFilters(); renderSources(); renderFooter();
  }

  function activeFilters() { return FILTERS.filter((k) => state[k]); }

  function renderKpis() {
    const k = snap.kpis, w = snap.window;
    const change = (o) => {
      if (!o.comparable) return '<div class="c">Insufficient data for comparison</div>';
      if (o.change === null) return '<div class="c">No change baseline</div>';
      const cls = o.change > 0 ? 'up' : o.change < 0 ? 'down' : '';
      return '<div class="c ' + cls + '">' + (o.change > 0 ? '▲ ' : o.change < 0 ? '▼ ' : '● ') + Math.abs(o.change) + '% vs previous ' + w + '</div>';
    };
    const card = (title, o, desc) => '<article class="kpi"><h3>' + title + '</h3><div class="v">' + o.value + '</div><div class="d">' + desc + '</div>' + change(o) + '</article>';
    const fin = k.financial.value;
    const finHtml = fin.length ? fin.slice(0, 3).map((f) => esc(money(f.total, f.currency))).join('<br>') : 'Not publicly disclosed';
    $('kpis').innerHTML =
      card('Reports analyzed', k.reports, 'Across ' + snap.health.sourcesEnabled + ' sources') +
      card('Confirmed incidents', k.confirmedIncidents, 'Distinct, first-party confirmed') +
      card('APT activity', k.apt, 'Incidents and campaigns') +
      card('Ransomware activity', k.ransomware, 'Distinct reported incidents') +
      card('Critical vulnerabilities', k.criticalVulns, 'Critical or actively exploited') +
      '<article class="kpi"><h3>Disclosed financial impact</h3><div class="v small">' + finHtml + '</div><div class="d">Direct, reported amounts only</div><div class="c">Per currency, not converted</div></article>';
  }

  function barRow(kind, id, label, n, max, pressed) {
    return '<button type="button" class="bar" data-' + kind + '="' + esc(id) + '" aria-pressed="' + pressed + '"><span>' + esc(label) + '</span><span class="t"><i style="width:' + (max ? Math.max(n ? 3 : 0, Math.round((n / max) * 100)) : 0) + '%"></i></span><span class="n">' + n + '</span></button>';
  }
  function renderSectors() {
    const max = Math.max(1, ...snap.sectors.map((s) => s.incidents));
    $('sectors').innerHTML = snap.sectors.map((s) => barRow('sector', s.id, s.label, s.incidents, max, state.sector === s.id)).join('');
    $('sectors').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => toggle('sector', b.dataset.sector)));
  }
  function renderRegions() {
    const max = Math.max(1, ...snap.regions.map((r) => r.incidents));
    $('regions').innerHTML = snap.regions.map((r) => '<div class="bar" style="cursor:default"><span>' + esc(r.name) + '</span><span class="t"><i style="width:' + (r.incidents ? Math.max(3, Math.round(r.incidents / max * 100)) : 0) + '%"></i></span><span class="n">' + r.incidents + '</span></div>').join('');
    $('countryTbl').querySelector('tbody').innerHTML = snap.countries.length ? snap.countries.map((c) => '<tr><td>' + esc(c.name) + '</td><td class="num">' + c.incidents + '</td></tr>').join('') : '<tr><td colspan="2">No countries identified in this window.</td></tr>';
    $('originNote').textContent = snap.origins.length ? 'Suspected attacker origin, as stated by the sources (not independently verified): ' + snap.origins.map((o) => o.name + ' (' + o.incidents + ')').join(', ') + '.' : '';
  }
  function renderAttacks() {
    const rows = snap.attackTypes.filter((a) => a.primary > 0 || a.associated > 0);
    const total = rows.reduce((n, a) => n + a.primary, 0);
    const R = 62, C = 2 * Math.PI * R; let off = 0;
    const segs = total ? rows.filter((a) => a.primary).map((a, i) => { const len = (a.primary / total) * C; const s = '<circle r="' + R + '" cx="80" cy="80" fill="none" stroke="' + COLORS[i % COLORS.length] + '" stroke-width="22" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '"/>'; off += len; return s; }).join('') : '<circle r="' + R + '" cx="80" cy="80" fill="none" stroke="#142c52" stroke-width="22"/>';
    $('donut').innerHTML = '<svg viewBox="0 0 160 160" aria-hidden="true">' + segs + '</svg><div class="mid"><b>' + total + '</b>incidents</div>';
    $('donut').setAttribute('aria-label', 'Attack types: ' + rows.map((a) => a.label + ' ' + a.primary).join(', '));
    $('attackLegend').innerHTML = rows.length ? rows.map((a, i) => '<li><button type="button" data-attack="' + esc(a.id) + '" aria-pressed="' + (state.attack === a.id) + '"><i style="background:' + COLORS[i % COLORS.length] + '"></i><span>' + esc(a.label) + '</span><span class="m">' + a.primary + ' (' + a.associated + ')</span></button></li>').join('') : '<li class="hint">No classified incidents in this window.</li>';
    $('attackLegend').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => toggle('attack', b.dataset.attack)));
  }
  function renderTrends() {
    $('trends').innerHTML = snap.trends.length ? snap.trends.map((t) => '<li><b>' + esc(t.title) + '</b><span>' + esc(t.detail) + '</span></li>').join('') : '<li><b>No notable developments in this window</b><span>Trends are calculated from the data that matches the current window and filters.</span></li>';
  }
  function renderFinancial() {
    const rows = snap.financial;
    $('financialBody').innerHTML = rows.length
      ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Incident</th><th>Impact type</th><th class="num">Amount</th><th>Basis</th><th>Source</th><th>Date</th></tr></thead><tbody>' +
        rows.map((f) => '<tr><td>' + esc(f.headline) + '</td><td>' + esc(f.typeLabel) + '</td><td class="num">' + esc(f.original) + '</td><td>' + esc(f.status) + (f.countedInTotal ? ' · in total' : ' · not in total') + '</td><td><a href="' + safeUrl(f.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.source) + '</a></td><td>' + day(f.publishedAt) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<p class="empty">Not publicly disclosed. No qualifying amounts were reported in this window.</p>';
  }

  function renderFeed() {
    const list = snap.feed;
    $('feedCount').textContent = list.length + ' item' + (list.length === 1 ? '' : 's');
    if (!list.length) { $('feedList').innerHTML = '<div class="empty">' + (snap.health.state === 'empty' ? 'No data yet.' : 'No items match the current window and filters.') + '</div>'; return; }
    $('feedList').innerHTML = list.map((c) => {
      const src = c.sources[0], more = c.sources.slice(1, 4);
      const attack = (snap.options.attacks.find((a) => a.id === c.primaryAttack) || {}).label || KIND[c.kind];
      return '<article class="card"><div class="row"><span class="pill sev-' + esc(c.severity) + '" title="Estimated from the text; not an official rating">' + esc(SEV[c.severity]) + '</span><span>' + esc(KIND[c.kind]) + (attack && attack !== KIND[c.kind] ? ' · ' + esc(attack) : '') + '</span><span style="margin-left:auto" title="' + esc(when(c.publishedAt)) + '">' + ago(c.publishedAt) + '</span></div>' +
        '<h3><a href="' + safeUrl(src.url) + '" target="_blank" rel="noopener noreferrer">' + esc(c.headline) + '</a></h3>' +
        (c.excerpt ? '<p>' + esc(c.excerpt) + '</p>' : '') +
        '<div class="row"><span class="pill ver ver-' + esc(c.verification) + '">' + esc(VER[c.verification]) + '</span><span>' + esc(c.sectorLabel) + '</span>' + (c.country ? '<span>' + esc(c.country) + '</span>' : '') + (c.suspectedOrigin ? '<span title="As stated by the source">Origin (reported): ' + esc(c.suspectedOrigin) + '</span>' : '') + '</div>' +
        ((c.cves.length || c.actors.length) ? '<div class="chips">' + c.cves.slice(0, 4).map((v) => '<span class="chip">' + esc(v) + '</span>').join('') + c.actors.slice(0, 3).map((v) => '<span class="chip">' + esc(v) + '</span>').join('') + '</div>' : '') +
        '<div class="srcs"><span>Source: <a href="' + safeUrl(src.url) + '" target="_blank" rel="noopener noreferrer">' + esc(src.name) + ' ↗</a></span>' + more.map((m) => '<a href="' + safeUrl(m.url) + '" target="_blank" rel="noopener noreferrer">' + esc(m.name) + ' ↗</a>').join('') + (c.sources.length > 4 ? '<span>+' + (c.sources.length - 4) + ' more</span>' : '') + '</div></article>';
    }).join('');
  }

  function renderFilters() {
    const f = $('filters'), o = snap.options;
    const fill = (name, items, label) => {
      const sel = f.elements[name]; if (!sel) return;
      const cur = state[name] || '';
      sel.innerHTML = '<option value="">All</option>' + items.map((i) => { const id = i.id || i, lb = i.label || (label ? label(i) : i); return '<option value="' + esc(id) + '"' + (id === cur ? ' selected' : '') + '>' + esc(lb) + '</option>'; }).join('');
    };
    fill('source', o.sources); fill('sector', o.sectors); fill('attack', o.attacks);
    fill('severity', o.severities, (s) => SEV[s]); fill('country', o.countries); fill('verification', o.verifications, (v) => VER[v]);
    if (!optionsBuilt) { f.addEventListener('change', (e) => { state[e.target.name] = e.target.value || undefined; load(); }); optionsBuilt = true; }
  }

  function renderSources() {
    $('sourceTbl').querySelector('tbody').innerHTML = snap.health.sources.map((s) => {
      const method = s.method === 'manual' ? 'Link-only (no automated access)' : s.method === 'sec-efts' ? 'SEC EDGAR search API' : 'Official RSS/Atom feed';
      const st = s.method === 'manual' || !s.enabled ? 'Link-only' : s.state === 'ok' ? 'Updated' : s.state === 'error' ? 'Error' : 'Pending';
      return '<tr><td><a href="' + safeUrl(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + '</a>' + (s.note ? '<br><span class="hint">' + esc(s.note) + '</span>' : '') + '</td><td>' + method + '</td><td>' + st + (s.lastError ? '<br><span class="hint">' + esc(s.lastError) + '</span>' : '') + '</td><td>' + (s.lastSuccessAt ? ago(s.lastSuccessAt) : '—') + '</td><td class="num">' + s.reports + '</td></tr>';
    }).join('');
  }
  function renderFooter() {
    const h = snap.health;
    $('fSources').textContent = h.sourcesUpdated + ' of ' + h.sourcesEnabled + ' (' + (h.sourcesTotal - h.sourcesEnabled) + ' link-only)';
    $('fLast').textContent = h.lastSuccessAt ? when(h.lastSuccessAt) : 'None yet';
    $('fCoverage').textContent = h.coverage ? day(h.coverage.from) + ' to ' + day(h.coverage.to) : 'No data yet';
    $('fNext').textContent = 'Every ' + h.refreshHours + ' hours' + (h.nextUpdateAt ? ' · next ≈ ' + new Date(h.nextUpdateAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');
  }

  function toggle(key, val) { state[key] = state[key] === val ? undefined : val; load(); }

  // events
  document.querySelectorAll('#windowSeg button').forEach((b) => b.addEventListener('click', () => { state.window = b.dataset.w; load(); }));
  $('resetBtn').addEventListener('click', () => { FILTERS.forEach((k) => (state[k] = undefined)); load(); });
  document.querySelectorAll('.side nav a[data-nav]').forEach((a) => a.addEventListener('click', () => {
    document.querySelectorAll('.side nav a').forEach((x) => x.classList.remove('active')); a.classList.add('active');
    if (a.dataset.preset !== undefined) { FILTERS.forEach((k) => (state[k] = undefined)); if (a.dataset.preset) { const [k, v] = a.dataset.preset.split('='); state[k] = v; } load(); }
  }));
  $('refreshBtn').addEventListener('click', async () => {
    const btn = $('refreshBtn'); btn.disabled = true; btn.textContent = 'Refreshing…';
    try {
      const r = await fetch(REFRESH_API, { method: 'POST' });
      if (r.status === 429) { const j = await r.json(); showBanner('Data was refreshed recently. You can refresh again in about ' + Math.ceil(j.retryAfterSeconds / 60) + ' min.'); }
      await load();
    } catch { showBanner('Refresh failed. Please try again later.', true); }
    btn.disabled = false; btn.textContent = 'Refresh';
  });
  const schedule = () => { clearInterval(timer); timer = setInterval(() => load(), AUTO_MS); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && snap && Date.now() - snap.generatedAt > AUTO_MS) load(); });
  schedule(); setInterval(() => { if (snap) { $('lastUpdated').textContent = snap.health.lastSuccessAt ? ago(snap.health.lastSuccessAt) + ' (' + when(snap.health.lastSuccessAt) + ')' : 'No successful ingestion yet'; } }, 60000);
  load();
})();
