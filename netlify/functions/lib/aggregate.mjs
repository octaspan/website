// Turns stored reports into the dashboard snapshot. Pure functions (no I/O) so they are unit-testable.
import { SECTORS, SECTOR_OTHER, SECTOR_LABELS, ATTACK_TYPES, ATTACK_LABELS, REGIONS } from './classify.mjs';

export const WINDOWS = { '24h': 24, '72h': 72, '7d': 168, '30d': 720 };
const SEV_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
const VER_RANK = { claimed: 0, reported: 1, confirmed: 2 };
const KIND_RANK = { other: 0, advisory: 1, campaign: 2, vulnerability: 3, incident: 4 };
const DIRECT_TYPES = ['incident_cost', 'regulatory', 'theft_loss', 'business_interruption', 'ransom_paid'];
export const FIN_LABELS = {
  incident_cost: 'Directly disclosed incident cost', ransom_demanded: 'Ransom demanded', ransom_paid: 'Ransom reportedly paid',
  regulatory: 'Regulatory fine or settlement', insurance: 'Cyber insurance claim or payout', theft_loss: 'Funds / assets stolen',
  business_interruption: 'Business interruption loss',
};

const uniq = (a) => [...new Set(a)];

export function buildClusters(reports) {
  const groups = new Map();
  for (const r of reports) { if (!groups.has(r.clusterId)) groups.set(r.clusterId, []); groups.get(r.clusterId).push(r); }
  const out = [];
  for (const [id, rs] of groups) {
    rs.sort((a, b) => b.publishedAt - a.publishedAt);
    const lead = [...rs].sort((a, b) => (VER_RANK[b.verification] - VER_RANK[a.verification]) || (b.publishedAt - a.publishedAt))[0];
    const kind = rs.map((r) => r.kind).sort((a, b) => KIND_RANK[b] - KIND_RANK[a])[0];
    const sector = (rs.find((r) => r.sector !== 'other') || lead).sector;
    const country = rs.find((r) => r.country);
    // financial amounts: a figure repeated across publications of one incident counts once
    const fin = new Map();
    for (const r of rs) for (const f of r.financial || []) {
      const k = `${f.type}|${f.currency}`;
      if (!fin.has(k) || f.amount > fin.get(k).amount) fin.set(k, { ...f, url: r.url, source: r.sourceName });
    }
    out.push({
      id, kind, sector, sectorLabel: SECTOR_LABELS[sector],
      headline: lead.title, excerpt: lead.excerpt, primaryAttack: lead.primaryAttack,
      attackTypes: uniq(rs.flatMap((r) => r.attackTypes)).filter((a) => a !== 'other' || rs.every((r) => r.attackTypes.every((x) => x === 'other'))),
      severity: rs.map((r) => r.severity).sort((a, b) => SEV_RANK[b] - SEV_RANK[a])[0],
      verification: rs.map((r) => r.verification).sort((a, b) => VER_RANK[b] - VER_RANK[a])[0],
      cves: uniq(rs.flatMap((r) => r.cves || [])), actors: uniq(rs.flatMap((r) => r.actors || [])),
      isApt: rs.some((r) => r.isApt), exploited: rs.some((r) => r.exploited),
      country: country ? country.country : null, region: country ? country.region : null,
      suspectedOrigin: (rs.find((r) => r.suspectedOrigin) || {}).suspectedOrigin || null,
      publishedAt: rs[0].publishedAt, firstSeen: rs[rs.length - 1].publishedAt, reportCount: rs.length,
      sources: rs.map((r) => ({ sourceId: r.sourceId, name: r.sourceName, title: r.title, url: r.url, publishedAt: r.publishedAt })),
      financial: [...fin.values()],
    });
  }
  return out.sort((a, b) => b.publishedAt - a.publishedAt);
}

function applyFilters(reports, q) {
  return reports.filter((r) =>
    (!q.sector || r.sector === q.sector) &&
    (!q.attack || r.attackTypes.includes(q.attack)) &&
    (!q.severity || r.severity === q.severity) &&
    (!q.country || r.country === q.country) &&
    (!q.source || r.sourceId === q.source) &&
    (!q.verification || r.verification === q.verification));
}

const isTracked = (c) => c.kind === 'incident' || c.kind === 'campaign';

function kpisFor(reports, clusters) {
  const tracked = clusters.filter(isTracked);
  const sums = new Map();
  for (const c of clusters) for (const f of c.financial) {
    if (!DIRECT_TYPES.includes(f.type) || f.status === 'alleged' || f.status === 'estimated') continue;
    sums.set(f.currency, (sums.get(f.currency) || 0) + f.amount);
  }
  return {
    reports: reports.length,
    confirmedIncidents: clusters.filter((c) => c.kind === 'incident' && c.verification === 'confirmed').length,
    apt: clusters.filter((c) => c.isApt).length,
    ransomware: clusters.filter((c) => c.kind === 'incident' && c.attackTypes.includes('ransomware')).length,
    criticalVulns: clusters.filter((c) => c.kind === 'vulnerability' && (c.severity === 'critical' || c.exploited)).length,
    financial: [...sums.entries()].map(([currency, total]) => ({ currency, total })).sort((a, b) => b.total - a.total),
    trackedIncidents: tracked.length,
  };
}

export function buildSnapshot({ reports, sources, status, now = Date.now(), query = {} }) {
  const wKey = WINDOWS[query.window] ? query.window : '72h';
  const W = WINDOWS[wKey] * 3600e3;
  const inWin = reports.filter((r) => r.publishedAt >= now - W && r.publishedAt <= now + 3600e3);
  const inPrev = reports.filter((r) => r.publishedAt >= now - 2 * W && r.publishedAt < now - W);
  const cur = applyFilters(inWin, query);
  const prev = applyFilters(inPrev, query);
  const clusters = buildClusters(cur);
  const kpi = kpisFor(cur, clusters);

  // Period-over-period is only shown when ingestion has run for at least two full windows
  // AND the prior window holds a meaningful sample; otherwise the UI shows "Insufficient data".
  const first = (status && status.firstIngestAt) || now;
  const comparable = first <= now - 2 * W && prev.length >= 10;
  const prevK = comparable ? kpisFor(prev, buildClusters(prev)) : null;
  const delta = (k) => (prevK && prevK[k] > 0 ? Math.round(((kpi[k] - prevK[k]) / prevK[k]) * 100) : null);
  const kpis = {
    reports: { value: kpi.reports, change: delta('reports'), comparable },
    confirmedIncidents: { value: kpi.confirmedIncidents, change: delta('confirmedIncidents'), comparable },
    apt: { value: kpi.apt, change: delta('apt'), comparable },
    ransomware: { value: kpi.ransomware, change: delta('ransomware'), comparable },
    criticalVulns: { value: kpi.criticalVulns, change: delta('criticalVulns'), comparable },
    financial: { value: kpi.financial, comparable: false },
  };

  const tracked = clusters.filter(isTracked);
  // Hover details for the KPI tiles: the exact items behind each number, a short breakdown, and the previous value.
  const countBy = (list, keyFn, labelFn, n = 4) => {
    const m = new Map(); list.forEach((x) => { const k = keyFn(x); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, c]) => ({ id, label: labelFn(id), n: c }));
  };
  const mini = (c) => ({ headline: c.headline, url: c.sources[0].url, source: c.sources[0].name, publishedAt: c.publishedAt, severity: c.severity, verification: c.verification });
  const bySector = (set) => ({ title: 'Top sectors', filter: 'sector', rows: countBy(set, (c) => (c.sector !== 'other' ? c.sector : null), (id) => SECTOR_LABELS[id]) });
  const kSets = {
    reports: clusters,
    confirmedIncidents: clusters.filter((c) => c.kind === 'incident' && c.verification === 'confirmed'),
    apt: clusters.filter((c) => c.isApt),
    ransomware: clusters.filter((c) => c.kind === 'incident' && c.attackTypes.includes('ransomware')),
    criticalVulns: clusters.filter((c) => c.kind === 'vulnerability' && (c.severity === 'critical' || c.exploited)),
  };
  const srcName = Object.fromEntries(sources.map((x) => [x.source_id, x.name]));
  const kpiDetails = {};
  for (const [k, set] of Object.entries(kSets)) {
    kpiDetails[k] = { previous: prevK ? prevK[k] : null, items: set.slice(0, 5).map(mini), more: Math.max(0, set.length - 5), breakdown: [] };
  }
  kpiDetails.reports.stories = clusters.length;
  kpiDetails.reports.breakdown.push({ title: 'Top sources', filter: 'source', rows: countBy(cur, (r) => r.sourceId, (id) => srcName[id] || id, 5) });
  kpiDetails.confirmedIncidents.breakdown.push(bySector(kSets.confirmedIncidents));
  kpiDetails.apt.breakdown.push(bySector(kSets.apt), { title: 'Named actors', rows: countBy(kSets.apt.flatMap((c) => c.actors.map((a) => ({ a }))), (x) => x.a, (id) => id, 4) });
  kpiDetails.ransomware.breakdown.push(bySector(kSets.ransomware));
  kpiDetails.criticalVulns.breakdown.push({ title: 'Most-cited CVEs', rows: countBy(kSets.criticalVulns.flatMap((c) => c.cves.map((v) => ({ v }))), (x) => x.v, (id) => id, 4) },
    { title: 'Actively exploited', rows: [{ id: 'exploited', label: 'Reported as exploited in the wild', n: kSets.criticalVulns.filter((c) => c.exploited).length }] });
  const sectors = [...SECTORS, SECTOR_OTHER].map((s) => ({
    id: s.id, label: s.label,
    incidents: tracked.filter((c) => c.sector === s.id).length,
    reports: cur.filter((r) => r.sector === s.id && (r.kind === 'incident' || r.kind === 'campaign')).length,
  })).sort((a, b) => (a.id === 'other') - (b.id === 'other') || b.incidents - a.incidents);

  const attackSet = clusters.filter((c) => isTracked(c) || (c.kind === 'vulnerability' && c.exploited));
  const attackTypes = ATTACK_TYPES.map((a) => ({
    id: a.id, label: a.label,
    primary: attackSet.filter((c) => c.primaryAttack === a.id).length,
    associated: attackSet.filter((c) => c.attackTypes.includes(a.id)).length,
  })).filter((a) => a.id !== 'other' || a.primary > 0).sort((a, b) => b.primary - a.primary);

  const geoSet = tracked;
  const regions = [...REGIONS, 'Unspecified'].map((name) => ({
    name, incidents: geoSet.filter((c) => (c.region || 'Unspecified') === name).length,
  }));
  const cmap = new Map();
  geoSet.forEach((c) => { if (c.country) cmap.set(c.country, (cmap.get(c.country) || 0) + 1); });
  const countries = [...cmap.entries()].map(([name, incidents]) => ({ name, incidents })).sort((a, b) => b.incidents - a.incidents);
  const origins = new Map();
  geoSet.forEach((c) => { if (c.suspectedOrigin) origins.set(c.suspectedOrigin, (origins.get(c.suspectedOrigin) || 0) + 1); });

  const limit = Math.min(parseInt(query.limit, 10) || 30, 100);
  const feed = clusters.filter((c) => c.kind !== 'other').slice(0, limit);

  const fin = [];
  for (const c of clusters) for (const f of c.financial) {
    fin.push({ headline: c.headline, amount: f.amount, currency: f.currency, original: f.original, type: f.type, typeLabel: FIN_LABELS[f.type],
      status: f.status, verification: c.verification, url: f.url, source: f.source, publishedAt: c.publishedAt, countedInTotal: DIRECT_TYPES.includes(f.type) && f.status === 'reported' });
  }
  fin.sort((a, b) => b.publishedAt - a.publishedAt);

  // Trends: each one is computed from stored data and worded as coverage, not prevalence.
  const trends = [];
  const avg = tracked.length ? (tracked.reduce((n, c) => n + c.reportCount, 0) / tracked.length) : 0;
  if (cur.length) trends.push({ id: 'coverage', title: `${cur.length} reports map to ${clusters.length} distinct stories`, detail: tracked.length ? `${tracked.length} incidents and campaigns, ${avg.toFixed(1)} reports each on average. Counts reflect media coverage, not the real-world frequency of attacks.` : 'Counts reflect media coverage, not the real-world frequency of attacks.' });
  const topSector = sectors.find((s) => s.incidents > 0 && s.id !== 'other');
  if (topSector) trends.push({ id: 'sector', title: `${topSector.label} is the most-reported sector`, detail: `${topSector.incidents} distinct incident${topSector.incidents === 1 ? '' : 's'} / campaigns in the last ${wKey}.` });
  if (kpi.ransomware) { const inc = clusters.filter((c) => c.kind === 'incident').length; trends.push({ id: 'ransomware', title: `${kpi.ransomware} ransomware incident${kpi.ransomware === 1 ? '' : 's'} reported`, detail: `${Math.round((kpi.ransomware / Math.max(inc, 1)) * 100)}% of the ${inc} incidents in this window.` }); }
  if (kpi.criticalVulns) { const top = clusters.find((c) => c.kind === 'vulnerability' && (c.severity === 'critical' || c.exploited)); trends.push({ id: 'vuln', title: `${kpi.criticalVulns} critical or actively exploited vulnerabilit${kpi.criticalVulns === 1 ? 'y' : 'ies'}`, detail: top ? `Latest: ${top.cves[0] ? top.cves[0] + ', ' : ''}${top.headline}` : '' }); }
  const sec = cur.filter((r) => r.sourceId === 'SRC-10').length;
  if (sec) trends.push({ id: 'sec', title: `${sec} SEC Form 8-K Item 1.05 filing${sec === 1 ? '' : 's'}`, detail: 'Material cybersecurity incident disclosures by listed companies.' });
  const gov = cur.filter((r) => r.sourceCategory === 'advisory').length;
  if (gov) trends.push({ id: 'gov', title: `${gov} government advisor${gov === 1 ? 'y' : 'ies'} published`, detail: 'From CISA (and CERT-In when its feed is enabled).' });
  if (comparable && delta('reports') !== null) trends.push({ id: 'volume', title: `Reporting volume ${delta('reports') >= 0 ? 'up' : 'down'} ${Math.abs(delta('reports'))}% vs the previous ${wKey}`, detail: 'A change in the number of articles published, which is not the same as a change in attack frequency.' });

  const enabled = sources.filter((s) => s.enabled && s.ingestion_method !== 'manual');
  const st = (status && status.sources) || {};
  const freshMs = 7 * 3600e3;
  const updated = enabled.filter((s) => st[s.source_id] && st[s.source_id].last_success_at && now - st[s.source_id].last_success_at < freshMs);
  const times = reports.map((r) => r.publishedAt);
  const lastSuccessAt = (status && status.lastSuccessAt) || null;
  const state = !lastSuccessAt ? (reports.length ? 'stale' : 'empty') : now - lastSuccessAt > freshMs ? 'stale' : 'ok';

  const present = (key, labels) => uniq(inWin.map((r) => r[key]).filter(Boolean)).sort().map((v) => ({ id: v, label: labels ? labels[v] || v : v }));
  return {
    generatedAt: now, window: wKey, query: { ...query, window: wKey },
    health: {
      state, lastSuccessAt, lastRunAt: (status && status.lastRunAt) || null, firstIngestAt: first,
      refreshHours: 3, nextUpdateAt: status && status.lastRunAt ? status.lastRunAt + 3 * 3600e3 : null,
      sourcesEnabled: enabled.length, sourcesUpdated: updated.length, sourcesTotal: sources.length,
      coverage: times.length ? { from: Math.min(...times), to: Math.max(...times) } : null,
      sources: sources.map((s) => ({ id: s.source_id, name: s.name, url: s.base_url, method: s.ingestion_method, enabled: s.enabled, note: s.note || '',
        state: st[s.source_id] ? st[s.source_id].state || 'pending' : 'pending', lastSuccessAt: (st[s.source_id] || {}).last_success_at || null,
        lastError: (st[s.source_id] || {}).last_error || '', reports: reports.filter((r) => r.sourceId === s.source_id && r.publishedAt >= now - W).length })),
    },
    kpis, kpiDetails, sectors, attackTypes, regions, countries, origins: [...origins.entries()].map(([name, n]) => ({ name, incidents: n })),
    feed, trends, financial: fin.slice(0, 40),
    options: {
      sectors: [...SECTORS, SECTOR_OTHER].map((s) => ({ id: s.id, label: s.label })),
      attacks: ATTACK_TYPES.filter((a) => a.id !== 'other').map((a) => ({ id: a.id, label: a.label })),
      countries: present('country'), sources: sources.filter((s) => s.enabled && s.ingestion_method !== 'manual').map((s) => ({ id: s.source_id, label: s.name })),
      severities: ['critical', 'high', 'medium', 'low', 'info'], verifications: ['confirmed', 'reported', 'claimed'],
    },
  };
}
