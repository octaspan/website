// GET /api/threat/history?days=365 — daily roll-up from the Supabase archive (for 12-month trend charts).
import { readDaily, archiveEnabled } from './lib/archive.mjs';

export default async (req) => {
  const days = new URL(req.url).searchParams.get('days') || 365;
  const h = { 'content-type': 'application/json', 'cache-control': 'public, max-age=300', 'netlify-cdn-cache-control': 'public, s-maxage=3600' };
  if (!archiveEnabled()) return new Response(JSON.stringify({ enabled: false, rows: [] }), { headers: h });
  try { return new Response(JSON.stringify({ enabled: true, rows: await readDaily(days) }), { headers: h }); }
  catch (e) { return new Response(JSON.stringify({ enabled: true, error: 'archive unavailable', rows: [] }), { status: 502, headers: h }); }
};
export const config = { path: '/api/threat/history' };
