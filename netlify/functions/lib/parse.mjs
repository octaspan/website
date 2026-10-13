// Feed parsing with no dependencies: RSS 2.0, Atom, and the SEC EDGAR full-text-search JSON.

export const decode = (s = '') => String(s)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, ' ').trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

export function canonicalUrl(u) {
  try {
    const x = new URL(u);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'ref'].forEach((k) => x.searchParams.delete(k));
    x.hash = '';
    return x.toString().replace(/\/$/, '');
  } catch { return ''; }
}

export function parseFeed(xml, now = Date.now()) {
  const items = [];
  const blocks = String(xml).match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*href=["']([^"']+)["']/i); link = m ? m[1] : ''; }
    if (!link) link = decode(tag(b, 'guid'));
    const dateRaw = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const ts = Date.parse(dateRaw);
    const summary = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content'));
    const url = canonicalUrl(link);
    if (!title || !url || !/^https?:/.test(url) || isNaN(ts) || ts > now + 6 * 3600e3) continue;
    items.push({ title, url, publishedAt: ts, summary });
  }
  return items;
}

/** SEC EDGAR full-text search (efts) JSON -> reports for 8-K filings that carry Item 1.05. */
export function parseSecSearch(json) {
  const hits = (json && json.hits && json.hits.hits) || [];
  const out = [];
  for (const h of hits) {
    const s = h._source || {};
    const items = s.items || [];
    if (!items.includes('1.05')) continue;
    const [adsh, file] = String(h._id || '').split(':');
    const cik = (s.ciks && s.ciks[0]) ? String(parseInt(s.ciks[0], 10)) : '';
    const ts = Date.parse(s.file_date);
    if (!adsh || !file || !cik || isNaN(ts)) continue;
    const name = ((s.display_names && s.display_names[0]) || 'Unknown issuer').replace(/\s*\(CIK[^)]*\)/i, '').trim();
    const form = s.form || '8-K';
    out.push({
      title: `${name}: ${form} Item 1.05 Material Cybersecurity Incident`,
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, '')}/${file}`,
      publishedAt: ts,
      summary: `${form} filed ${s.file_date} under Item 1.05 (Material Cybersecurity Incidents). Read the filing for the issuer's description of the incident and its material impact.`,
      issuer: name,
    });
  }
  return out;
}
