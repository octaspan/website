// Dashboard API: GET /api/threat/snapshot?window=72h&sector=&attack=&severity=&country=&source=&verification=
import { getJSON } from './lib/store.mjs';
import { mergeRegistry } from './lib/sources.mjs';
import { buildSnapshot } from './lib/aggregate.mjs';
import { runIngest } from './lib/ingest.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const query = Object.fromEntries([...url.searchParams.entries()].filter(([, v]) => v));
  let status = await getJSON('status', null);
  // First visit after deploy (empty store): run one ingestion so the dashboard is never blank.
  if (!status || !status.lastRunAt) {
    try { await runIngest({}); } catch { /* reported via health state */ }
    status = await getJSON('status', null);
  }
  const reports = await getJSON('reports', []);
  const sources = mergeRegistry(await getJSON('sources', null));
  const snap = buildSnapshot({ reports, sources, status, query });
  return new Response(JSON.stringify(snap), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', 'netlify-cdn-cache-control': 'public, max-age=60, stale-while-revalidate=300' },
  });
};
export const config = { path: '/api/threat/snapshot' };
