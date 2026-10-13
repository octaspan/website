// Manual refresh: POST /api/threat/refresh. Rate-limited to one run per 10 minutes (shared by all visitors).
import { getJSON, setJSON } from './lib/store.mjs';
import { runIngest } from './lib/ingest.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { 'content-type': 'application/json' } });
  const now = Date.now();
  const last = await getJSON('manual_refresh', { at: 0 });
  if (now - last.at < 10 * 60000) {
    return new Response(JSON.stringify({ ok: false, reason: 'rate_limited', retryAfterSeconds: Math.ceil((10 * 60000 - (now - last.at)) / 1000) }), { status: 429, headers: { 'content-type': 'application/json' } });
  }
  await setJSON('manual_refresh', { at: now });
  const result = await runIngest({ now });
  return new Response(JSON.stringify({ ok: true, result }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
export const config = { path: '/api/threat/refresh' };
