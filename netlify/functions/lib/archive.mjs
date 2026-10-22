// Long-term archive in Supabase (Postgres, free tier). Optional: does nothing unless
// SUPABASE_URL and SUPABASE_SERVICE_KEY are set in Netlify. Failures never break ingestion.
const cfg = () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  return url && key ? { url, key } : null;
};
export const archiveEnabled = () => !!cfg();

// Legacy keys are JWTs (sent as apikey + Bearer). New "sb_secret_..." keys are NOT JWTs: apikey header only.
const authHeaders = (key) => (key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: `Bearer ${key}` });
const iso = (ms) => new Date(ms).toISOString();
export function toRow(r) {
  return {
    id: r.id, published_at: iso(r.publishedAt), first_seen_at: iso(r.ingestedAt || r.publishedAt),
    source_id: r.sourceId, source_name: r.sourceName, title: r.title, url: r.url,
    kind: r.kind || null, sector: r.sector || null, primary_attack: r.primaryAttack || null,
    attack_types: r.attackTypes || [], severity: r.severity || null, verification: r.verification || null,
    country: r.country || null, region: r.region || null, is_apt: !!r.isApt, exploited: !!r.exploited,
    cves: r.cves || [], actors: r.actors || [], financial: r.financial || null, excerpt: r.excerpt || null,
  };
}

// Insert reports we have not archived yet (existing ids are left untouched).
export async function archiveReports(reports, { fetchImpl = fetch } = {}) {
  const c = cfg(); if (!c || !reports.length) return { archived: 0 };
  const res = await fetchImpl(`${c.url}/rest/v1/threat_reports?on_conflict=id`, {
    method: 'POST',
    headers: { ...authHeaders(c.key), 'content-type': 'application/json', prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(reports.map(toRow)),
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return { archived: reports.length };
}

// Daily roll-up rows for the last N days (max 400).
export async function readDaily(days = 365, { fetchImpl = fetch } = {}) {
  const c = cfg(); if (!c) return null;
  const n = Math.min(Math.max(parseInt(days, 10) || 365, 1), 400);
  const since = new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
  const res = await fetchImpl(`${c.url}/rest/v1/threat_daily?day=gte.${since}&order=day.asc&limit=20000`, {
    headers: authHeaders(c.key),
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
