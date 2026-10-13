import { createHash } from 'node:crypto';
import { getJSON, setJSON } from './store.mjs';
import { DEFAULT_SOURCES, mergeRegistry, SEC_USER_AGENT } from './sources.mjs';
import { parseFeed, parseSecSearch, canonicalUrl } from './parse.mjs';
import { classify } from './classify.mjs';
import { clusterReports } from './cluster.mjs';

export const RETENTION_DAYS = 35;
const MAX_REPORTS = 2500;
const UA = 'OctaspanThreatSnapshot/1.0 (+https://www.octaspan.com; octaspan.cybersecurity@gmail.com)';

const idFor = (url) => createHash('sha1').update(canonicalUrl(url) || url).digest('hex').slice(0, 16);

/** Short excerpt (max ~2 sentences / 260 chars) of the publisher's own description. Never the full article. */
export function excerptOf(summary) {
  const s = String(summary || '').replace(/\s*(The post|Read more|Continue reading).*$/i, '').trim();
  if (!s) return '';
  // split only where a capital letter starts the next sentence, so "U.S. firm" and "1.2 TB" stay intact
  const sentences = s.split(/(?<=[.!?])\s+(?=[A-Z])/);
  let out = '';
  for (const part of sentences.slice(0, 2)) { const next = out ? out + ' ' + part : part; if (next.length > 260) break; out = next; }
  out = (out || s.slice(0, 257)).trim();
  return out.length < s.length && !/[.!?…]$/.test(out) ? out.replace(/[,;:\s]+$/, '') + '…' : out;
}

async function fetchText(url, fetchImpl, timeoutMs, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, application/json, text/xml, */*', ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

async function fetchSource(src, fetchImpl, now) {
  const timeout = (src.rate_limit_configuration && src.rate_limit_configuration.request_timeout_ms) || 8000;
  if (src.ingestion_method === 'rss') {
    return parseFeed(await fetchText(src.feed_or_api_url, fetchImpl, timeout), now);
  }
  if (src.ingestion_method === 'sec-efts') {
    // SEC fair-access: identify ourselves and keep to one request per run.
    const d = (ms) => new Date(ms).toISOString().slice(0, 10);
    const url = `${src.feed_or_api_url}?q=${encodeURIComponent('"Item 1.05"')}&forms=8-K&dateRange=custom&startdt=${d(now - 30 * 86400e3)}&enddt=${d(now)}`;
    return parseSecSearch(JSON.parse(await fetchText(url, fetchImpl, timeout, { 'user-agent': SEC_USER_AGENT, accept: 'application/json' })));
  }
  return null; // manual / link-only
}

export async function runIngest({ fetchImpl = fetch, now = Date.now(), force = false } = {}) {
  const lock = await getJSON('lock', null);
  if (lock && now - lock.at < 120000 && !force) return { skipped: 'another run is in progress' };
  await setJSON('lock', { at: now });
  try {
    const registry = mergeRegistry(await getJSON('sources', null));
    const status = await getJSON('status', { firstIngestAt: now, sources: {} });
    const existing = await getJSON('reports', []);
    const byId = new Map(existing.map((r) => [r.id, r]));
    const summary = { fetched: 0, added: 0, sources: {} };

    await Promise.all(registry.map(async (src) => {
      const st = status.sources[src.source_id] || {};
      status.sources[src.source_id] = st;
      if (!src.enabled || src.ingestion_method === 'manual') { st.state = 'manual'; return; }
      const minGap = ((src.rate_limit_configuration && src.rate_limit_configuration.min_interval_minutes) || 60) * 60000;
      if (!force && st.last_attempt_at && now - st.last_attempt_at < minGap) { summary.sources[src.source_id] = 'skipped (rate limit)'; return; }
      st.last_attempt_at = now;
      try {
        const items = await fetchSource(src, fetchImpl, now);
        let added = 0;
        for (const it of items || []) {
          const id = idFor(it.url);
          const cls = classify({ title: it.title, summary: it.summary, source: src });
          const prev = byId.get(id);
          byId.set(id, {
            id, sourceId: src.source_id, sourceName: src.name, sourceCategory: src.category,
            title: it.title, url: it.url, publishedAt: it.publishedAt,
            ingestedAt: prev ? prev.ingestedAt : now, excerpt: excerptOf(it.summary), ...cls,
          });
          if (!prev) added++;
        }
        st.last_success_at = now; st.last_error = ''; st.last_item_count = (items || []).length; st.state = 'ok';
        summary.fetched += (items || []).length; summary.added += added; summary.sources[src.source_id] = `ok (${(items || []).length} items, ${added} new)`;
      } catch (e) {
        st.last_error = String(e && e.message ? e.message : e).slice(0, 200); st.state = 'error';
        summary.sources[src.source_id] = 'error: ' + st.last_error;
      }
    }));

    const cutoff = now - RETENTION_DAYS * 86400e3;
    const reports = [...byId.values()].filter((r) => r.publishedAt >= cutoff).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, MAX_REPORTS);
    clusterReports(reports);
    status.lastRunAt = now;
    if (Object.values(status.sources).some((s) => s.last_success_at === now)) status.lastSuccessAt = now;
    await setJSON('reports', reports);
    await setJSON('sources', registry);
    await setJSON('status', status);
    summary.total = reports.length;
    return summary;
  } finally {
    await setJSON('lock', { at: 0 });
  }
}
export { DEFAULT_SOURCES };
