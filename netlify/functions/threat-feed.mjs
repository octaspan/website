// Live threat feed: pulls public cybersecurity RSS feeds, sorts stories by sector,
// and returns a compact JSON summary. The response is cached at the Netlify CDN for
// 3 hours, so the upstream feeds are fetched at most once per 3h window.

const FEEDS = [
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'SecurityWeek', url: 'https://feeds.feedburner.com/securityweek' },
  { name: 'The Record', url: 'https://therecord.media/feed' },
  { name: 'CISA Advisories', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml' },
];

const SECTORS = [
  { id: 'ai', label: 'AI & LLM attacks',
    re: /\b(ai|a\.i\.|llm|llms|chatgpt|openai|gemini|copilot|claude|anthropic|prompt injection|jailbreak|model poisoning|generative|deepfake|machine learning|mcp)\b/i },
  { id: 'bfsi', label: 'BFSI',
    re: /\b(bank|banks|banking|fintech|financial|insurance|insurer|payment|payments|credit union|brokerage|swift|upi|atm|crypto exchange|lender|loan|fraud)\b/i },
  { id: 'fmcg', label: 'FMCG & Retail',
    re: /\b(retail|retailer|fmcg|consumer goods|e-?commerce|supermarket|grocery|food|beverage|brand|stores?|shopping|supply chain|manufactur\w*)\b/i },
  { id: 'govt', label: 'Government',
    re: /\b(government|govt|ministry|federal|municipal|state agency|public sector|military|defen[cs]e|election|parliament|cisa|nato|agency|city of|county)\b/i },
  { id: 'health', label: 'Healthcare',
    re: /\b(hospital|health|healthcare|medical|pharma|patient|clinic)\b/i },
  { id: 'energy', label: 'Energy & Critical Infra',
    re: /\b(energy|power grid|utility|utilities|oil|gas|pipeline|ics|scada|ot security|critical infrastructure|water)\b/i },
];

const WINDOW_HOURS = 72;

const decode = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, ' ').trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

export function parseFeed(xml, source) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*href=["']([^"']+)["']/i); link = m ? m[1] : ''; }
    const date = new Date(decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
    const summary = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded')).slice(0, 400);
    if (!title || !/^https?:\/\//.test(link) || isNaN(date)) continue;
    items.push({ title, link, summary, source, ts: date.getTime() });
  }
  return items;
}

export function classify(items, now = Date.now()) {
  const cutoff = now - WINDOW_HOURS * 3600 * 1000;
  const seen = new Set();
  const recent = items
    .filter((i) => i.ts >= cutoff && i.ts <= now + 3600 * 1000)
    .sort((a, b) => b.ts - a.ts)
    .filter((i) => (seen.has(i.link) ? false : seen.add(i.link)));

  // match on the headline first; fall back to the summary only for the AI/Govt/etc. keywords
  // that are unambiguous, so unrelated stories don't inflate sector counts.
  return SECTORS.map((s) => {
    const hits = recent.filter((i) => s.re.test(i.title));
    const top = hits[0];
    return {
      id: s.id,
      label: s.label,
      count: hits.length,
      latest: top ? { title: top.title, url: top.link, source: top.source, ts: top.ts } : null,
    };
  });
}

async function fetchOne(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'OctaspanThreatFeed/1.0 (+https://www.octaspan.com)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, name: feed.name, items: parseFeed(await res.text(), feed.name) };
  } catch (e) {
    return { ok: false, name: feed.name, items: [] };
  } finally { clearTimeout(t); }
}

export default async () => {
  const results = await Promise.all(FEEDS.map(fetchOne));
  const live = results.filter((r) => r.ok);
  const items = live.flatMap((r) => r.items);
  const body = {
    generatedAt: new Date().toISOString(),
    windowHours: WINDOW_HOURS,
    refreshHours: 3,
    sources: live.map((r) => r.name),
    totalStories: items.length,
    sectors: classify(items),
  };
  const ok = live.length > 0;
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 502,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      // 3h CDN cache; serve stale for up to 1h while refreshing in the background
      'netlify-cdn-cache-control': ok ? 'public, max-age=10800, stale-while-revalidate=3600, durable' : 'no-store',
      'cache-control': 'public, max-age=300',
    },
  });
};

export const config = { path: '/api/threat-feed' };
