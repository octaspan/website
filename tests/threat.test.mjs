import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, parseSecSearch } from '../netlify/functions/lib/parse.mjs';
import { classify, extractFinancial } from '../netlify/functions/lib/classify.mjs';
import { clusterReports } from '../netlify/functions/lib/cluster.mjs';
import { runIngest, excerptOf } from '../netlify/functions/lib/ingest.mjs';
import { buildSnapshot } from '../netlify/functions/lib/aggregate.mjs';
import { mergeRegistry } from '../netlify/functions/lib/sources.mjs';
import { getJSON, _resetMemory } from '../netlify/functions/lib/store.mjs';

const NOW = Date.parse('2026-10-13T08:00:00Z');
const hrs = (h) => new Date(NOW - h * 3600e3).toUTCString();
const rss = (items) => `<?xml version="1.0"?><rss><channel>${items.map((i) => `<item><title><![CDATA[${i[0]}]]></title><link>${i[1]}</link><pubDate>${hrs(i[2])}</pubDate><description><![CDATA[<p>${i[3] || ''}</p>]]></description></item>`).join('')}</channel></rss>`;
const atom = `<feed><entry><title>CISA adds flaw CVE-2026-1111 to KEV catalog</title><link href="https://www.cisa.gov/a/1?utm_source=x"/><updated>${new Date(NOW - 3600e3).toISOString()}</updated><summary>Known exploited vulnerability, actively exploited in the wild.</summary></entry></feed>`;

test('parseFeed handles RSS + Atom, strips tracking params, drops future/invalid items', () => {
  const a = parseFeed(rss([['Hello &amp; world', 'https://x.com/p?utm_source=a', 2, 'Body']]), NOW);
  assert.equal(a[0].title, 'Hello & world'); assert.equal(a[0].url, 'https://x.com/p');
  const b = parseFeed(atom, NOW); assert.equal(b[0].url, 'https://www.cisa.gov/a/1');
  assert.equal(parseFeed(rss([['Future', 'https://x.com/f', -48]]), NOW).length, 0);
  assert.equal(parseFeed('<rss></rss>', NOW).length, 0);
});

test('parseSecSearch keeps only Item 1.05 filings and builds a direct filing URL', () => {
  const j = { hits: { hits: [
    { _id: '0001234567-26-000099:ex.htm', _source: { ciks: ['0001234567'], display_names: ['Acme Corp  (ACME)  (CIK 0001234567)'], file_date: '2026-10-10', items: ['1.05', '9.01'], form: '8-K' } },
    { _id: '0001234567-26-000100:y.htm', _source: { ciks: ['0001234567'], display_names: ['Other'], file_date: '2026-10-10', items: ['2.02'], form: '8-K' } } ] } };
  const r = parseSecSearch(j); assert.equal(r.length, 1);
  assert.equal(r[0].url, 'https://www.sec.gov/Archives/edgar/data/1234567/000123456726000099/ex.htm');
});

test('classification: sector, attack, country, verification, severity', () => {
  const src = { category: 'news' };
  let c = classify({ title: 'Ransomware group claims attack on major U.S. healthcare provider', summary: 'Gang says it stole 1.2 TB.', source: src });
  assert.equal(c.sector, 'health'); assert.equal(c.primaryAttack, 'ransomware'); assert.equal(c.country, 'United States');
  assert.equal(c.verification, 'claimed'); assert.equal(c.severity, 'high'); assert.equal(c.kind, 'incident');
  c = classify({ title: 'Critical Fortinet flaw CVE-2026-1234 actively exploited', summary: '', source: src });
  assert.equal(c.kind, 'vulnerability'); assert.equal(c.severity, 'critical'); assert.deepEqual(c.cves, ['CVE-2026-1234']);
  c = classify({ title: 'Prompt injection flaw lets attackers hijack AI agents', summary: '', source: src });
  assert.ok(c.attackTypes.includes('ai'));
  c = classify({ title: 'Said the company', summary: 'detail', source: src });
  assert.ok(!c.attackTypes.includes('ai'), 'lowercase "ai" inside words must not match');
});

test('origin is only repeated when the source states it, and is never the victim country', () => {
  const c = classify({ title: 'China-linked hackers target Indian government networks', summary: '', source: { category: 'news' } });
  assert.equal(c.country, 'India'); assert.equal(c.suspectedOrigin, 'China');
});

test('financial extraction: typed, conservative, ransomware word is not a ransom demand', () => {
  const f = extractFinancial('Retailer says ransomware attack cost it £40m in recovery');
  assert.equal(f.length, 1); assert.equal(f[0].type, 'incident_cost'); assert.equal(f[0].amount, 40e6); assert.equal(f[0].currency, 'GBP');
  assert.equal(extractFinancial('Firm offers a $5 million bug bounty').length, 0);
  assert.equal(extractFinancial('Attackers demanded a $2 million ransom')[0].type, 'ransom_demanded');
  assert.equal(extractFinancial('Bank fined $5 million over breach')[0].type, 'regulatory');
});

test('clustering: same CVE or near-identical headlines merge; unrelated stay apart', () => {
  const mk = (id, title, h, cves = []) => ({ id, title, publishedAt: NOW - h * 3600e3, cves });
  const rs = [mk('a', 'Hackers breach Acme Corp customer database', 5), mk('b', 'Acme Corp customer database breached by hackers', 6),
    mk('c', 'Fortinet flaw exploited', 7, ['CVE-2026-1']), mk('d', 'Zero-day in FortiGate abused', 8, ['CVE-2026-1']), mk('e', 'Totally different story about banks', 9)];
  const cl = clusterReports(rs);
  assert.equal(cl.size, 3);
  assert.equal(rs[0].clusterId, rs[1].clusterId); assert.equal(rs[2].clusterId, rs[3].clusterId); assert.notEqual(rs[0].clusterId, rs[4].clusterId);
});

test('excerpt keeps abbreviations and decimals intact', () => {
  const e = excerptOf('The group claims a ransomware attack on a U.S. healthcare organization, alleging theft of 1.2 TB of data. The provider has not commented. A third sentence.');
  assert.ok(e.startsWith('The group claims') && e.includes('U.S. healthcare') && e.includes('1.2 TB') && !e.includes('third') && e.includes('data. The provider'));
});

test('excerpt is a short extract, not the article', () => {
  const long = 'First sentence is here. Second sentence follows. Third sentence should not appear at all. ' + 'x'.repeat(500);
  const e = excerptOf(long); assert.ok(e.length <= 270); assert.ok(!e.includes('Third'));
});

function fakeFetch(map) {
  return async (url) => {
    const hit = Object.keys(map).find((k) => url.startsWith(k));
    if (!hit) return { ok: false, status: 404, text: async () => '' };
    const v = map[hit]; if (v instanceof Error) throw v;
    return { ok: true, status: 200, text: async () => v };
  };
}

test('end-to-end: ingest -> dedupe -> snapshot; one incident in 3 outlets counts once; broken source is isolated', async () => {
  _resetMemory();
  const fetchImpl = fakeFetch({
    'https://www.bleepingcomputer.com/feed/': rss([
      ['Ransomware gang claims attack on U.S. hospital network Mercy Health', 'https://bc.com/1', 3, 'The group claims it stole 1.2 TB.'],
      ['Critical Fortinet flaw CVE-2026-1234 actively exploited', 'https://bc.com/2', 6, 'Attackers exploit the bug.']]),
    'https://therecord.media/feed': rss([['Mercy Health hospital network hit by ransomware gang', 'https://tr.com/1', 4, 'Hospital confirms disruption.']]),
    'https://feeds.feedburner.com/securityweek': rss([['Hospital network Mercy Health ransomware attack disrupts care', 'https://sw.com/1', 5]]),
    'https://feeds.feedburner.com/TheHackersNews': new Error('boom'),
    'https://www.cisa.gov/cybersecurity-advisories/all.xml': atom,
    'https://www.microsoft.com/en-us/security/blog/feed/': rss([['Midnight Blizzard campaign targets government email', 'https://ms.com/1', 40, 'Microsoft Threat Intelligence tracked the nation-state actor.']]),
  });
  const res = await runIngest({ fetchImpl, now: NOW, force: true });
  assert.ok(res.total >= 6);
  const reports = await getJSON('reports'); const status = await getJSON('status'); const sources = mergeRegistry(await getJSON('sources'));
  assert.equal(status.sources['SRC-04'].state, 'error');
  assert.equal(status.sources['SRC-01'].state, 'ok');
  assert.equal(status.sources['SRC-05'].state, 'manual');

  const snap = buildSnapshot({ reports, sources, status, now: NOW, query: { window: '72h' } });
  assert.equal(snap.kpis.reports.value, reports.length);
  assert.equal(snap.kpis.ransomware.value, 1, 'three outlets, one ransomware incident');
  const merc = snap.feed.find((c) => /Mercy/.test(c.headline));
  assert.equal(merc.reportCount, 3); assert.equal(merc.sources.length, 3);
  assert.equal(snap.kpis.criticalVulns.value, 2, 'Fortinet CVE + CISA KEV entry are distinct vulnerabilities');
  assert.equal(snap.kpis.apt.value >= 1, true);
  assert.equal(snap.kpis.apt.comparable, false, 'no prior-period data yet');
  assert.equal(snap.kpis.reports.change, null);
  assert.deepEqual(snap.kpis.financial.value, []);
  assert.equal(snap.health.sourcesEnabled, 8);
  assert.equal(snap.health.state, 'ok');
  assert.ok(snap.sectors.find((s) => s.id === 'health').incidents === 1);

  const filtered = buildSnapshot({ reports, sources, status, now: NOW, query: { window: '72h', sector: 'health' } });
  assert.ok(filtered.feed.every((c) => c.sector === 'health'));
  const narrow = buildSnapshot({ reports, sources, status, now: NOW, query: { window: '24h' } });
  assert.ok(narrow.kpis.reports.value < snap.kpis.reports.value);
});

test('period-over-period shows only with enough history', () => {
  const mk = (i, h) => ({ id: 'r' + i, clusterId: 'C' + i, sourceId: 'SRC-01', sourceName: 'x', sourceCategory: 'news', title: 't' + i, url: 'u' + i, publishedAt: NOW - h * 3600e3,
    kind: 'incident', sector: 'other', attackTypes: ['ransomware'], primaryAttack: 'ransomware', severity: 'high', verification: 'reported', cves: [], actors: [], financial: [] });
  const reports = [...Array.from({ length: 12 }, (_, i) => mk(i, 10 + i)), ...Array.from({ length: 12 }, (_, i) => mk(100 + i, 80 + i))];
  const sources = mergeRegistry(null);
  const no = buildSnapshot({ reports, sources, status: { firstIngestAt: NOW - 2 * 3600e3, sources: {} }, now: NOW, query: { window: '72h' } });
  assert.equal(no.kpis.reports.comparable, false);
  const yes = buildSnapshot({ reports, sources, status: { firstIngestAt: NOW - 10 * 86400e3, sources: {} }, now: NOW, query: { window: '72h' } });
  assert.equal(yes.kpis.reports.comparable, true); assert.equal(yes.kpis.reports.change, 0);
});

test('financial totals exclude demands/alleged/estimated and never double count one incident', () => {
  const base = { sourceId: 'SRC-01', sourceName: 'x', sourceCategory: 'news', kind: 'incident', sector: 'other', attackTypes: ['breach'], primaryAttack: 'breach', severity: 'medium', verification: 'confirmed', cves: [], actors: [] };
  const reports = [
    { ...base, id: '1', clusterId: 'C1', title: 'a', url: 'u1', publishedAt: NOW - 3600e3, financial: [{ amount: 5e6, currency: 'USD', original: '$5 million', type: 'incident_cost', status: 'reported' }, { amount: 2e6, currency: 'USD', original: '$2 million', type: 'ransom_demanded', status: 'alleged' }] },
    { ...base, id: '2', clusterId: 'C1', title: 'a2', url: 'u2', publishedAt: NOW - 7200e3, financial: [{ amount: 5e6, currency: 'USD', original: '$5 million', type: 'incident_cost', status: 'reported' }] },
  ];
  const snap = buildSnapshot({ reports, sources: mergeRegistry(null), status: { firstIngestAt: NOW, sources: {} }, now: NOW, query: {} });
  assert.deepEqual(snap.kpis.financial.value, [{ currency: 'USD', total: 5e6 }]);
});

import { toRow, archiveReports } from '../netlify/functions/lib/archive.mjs';
test('archive: maps a report to a row and posts only when configured', async () => {
  const r = { id: 'a1', sourceId: 'SRC-01', sourceName: 'X', title: 't', url: 'https://x/y', publishedAt: 1700000000000, ingestedAt: 1700000100000, sector: 'bfsi', attackTypes: ['ransomware'], cves: [], actors: [] };
  const row = toRow(r);
  assert.equal(row.published_at, '2023-11-14T22:13:20.000Z');
  assert.deepEqual(row.attack_types, ['ransomware']);
  assert.deepEqual(await archiveReports([r], { fetchImpl: () => { throw new Error('must not call'); } }), { archived: 0 });
  process.env.SUPABASE_URL = 'https://p.supabase.co'; process.env.SUPABASE_SERVICE_KEY = 'k';
  let seen;
  const out = await archiveReports([r], { fetchImpl: async (u, o) => { seen = { u, o }; return { ok: true }; } });
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
  assert.equal(out.archived, 1);
  assert.match(seen.u, /threat_reports\?on_conflict=id$/);
  assert.equal(seen.o.headers.authorization, 'Bearer k'); assert.equal(seen.o.headers.apikey, 'k');
});

test('archive: SUPABASE_URL is normalised to its origin', async () => {
  process.env.SUPABASE_SERVICE_KEY = 'k';
  let seen;
  for (const u of ['https://p.supabase.co/rest/v1/', 'p.supabase.co', ' https://p.supabase.co/ ']) {
    process.env.SUPABASE_URL = u;
    await archiveReports([{ id: 'a', sourceId: 'S', title: 't', url: 'u', publishedAt: 1, ingestedAt: 1 }], { fetchImpl: async (x) => { seen = x; return { ok: true }; } });
    assert.equal(seen, 'https://p.supabase.co/rest/v1/threat_reports?on_conflict=id');
  }
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
});
