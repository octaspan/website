// Source registry. Seeded into the datastore on first run; after that the stored copy is the
// source of truth, so a source can be enabled/disabled or re-pointed without a code change.
// Only officially published feeds/APIs are used. Sources without a verified, permitted
// machine-readable feed are registered as "manual" (link-only) and are never scraped.

export const DEFAULT_SOURCES = [
  { source_id: 'SRC-01', name: 'BleepingComputer', base_url: 'https://www.bleepingcomputer.com/', category: 'news',
    source_type: 'news', ingestion_method: 'rss', feed_or_api_url: 'https://www.bleepingcomputer.com/feed/', enabled: true },
  { source_id: 'SRC-02', name: 'The Record', base_url: 'https://therecord.media/', category: 'news',
    source_type: 'news', ingestion_method: 'rss', feed_or_api_url: 'https://therecord.media/feed', enabled: true },
  { source_id: 'SRC-03', name: 'SecurityWeek', base_url: 'https://www.securityweek.com/', category: 'news',
    source_type: 'news', ingestion_method: 'rss', feed_or_api_url: 'https://feeds.feedburner.com/securityweek', enabled: true },
  { source_id: 'SRC-04', name: 'The Hacker News', base_url: 'https://thehackernews.com/', category: 'news',
    source_type: 'news', ingestion_method: 'rss', feed_or_api_url: 'https://feeds.feedburner.com/TheHackersNews', enabled: true },
  { source_id: 'SRC-05', name: 'Reuters', base_url: 'https://www.reuters.com/', category: 'news',
    source_type: 'news', ingestion_method: 'manual', feed_or_api_url: '', enabled: false,
    note: 'No public feed permitted for automated reuse. Link-only: add items manually.' },
  { source_id: 'SRC-06', name: 'CISA Cybersecurity Advisories', base_url: 'https://www.cisa.gov/news-events/cybersecurity-advisories', category: 'advisory',
    source_type: 'government', ingestion_method: 'rss', feed_or_api_url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', enabled: true },
  { source_id: 'SRC-07', name: 'CERT-In', base_url: 'https://www.cert-in.org.in/', category: 'advisory',
    source_type: 'government', ingestion_method: 'manual', feed_or_api_url: '', enabled: false,
    note: 'No verified machine-readable feed. Link-only until an official feed URL is confirmed; set ingestion_method to "rss" and feed_or_api_url to enable.' },
  { source_id: 'SRC-08', name: 'Microsoft Threat Intelligence', base_url: 'https://www.microsoft.com/en-us/security/blog/', category: 'research',
    source_type: 'vendor-research', ingestion_method: 'rss', feed_or_api_url: 'https://www.microsoft.com/en-us/security/blog/feed/', enabled: true },
  { source_id: 'SRC-09', name: 'Mandiant Threat Intelligence', base_url: 'https://cloud.google.com/blog/topics/threat-intelligence', category: 'research',
    source_type: 'vendor-research', ingestion_method: 'rss', feed_or_api_url: 'https://cloudblog.withgoogle.com/topics/threat-intelligence/rss/', enabled: true },
  { source_id: 'SRC-10', name: 'SEC EDGAR (8-K Item 1.05)', base_url: 'https://www.sec.gov/edgar/search/', category: 'sec',
    source_type: 'regulatory-filing', ingestion_method: 'sec-efts', feed_or_api_url: 'https://efts.sec.gov/LATEST/search-index', enabled: true },
].map((s) => ({
  polling_interval_minutes: 180,
  attribution_required: true,
  redistribution_policy: 'Headline, short excerpt and link to the original publisher only',
  rate_limit_configuration: { min_interval_minutes: 60, request_timeout_ms: 8000 },
  note: '',
  ...s,
}));

export const SEC_USER_AGENT = 'Octaspan Cybersecurity Solutions LLP octaspan.cybersecurity@gmail.com';

export function mergeRegistry(stored) {
  const byId = new Map((stored || []).map((s) => [s.source_id, s]));
  return DEFAULT_SOURCES.map((d) => ({ ...d, ...(byId.get(d.source_id) || {}) }));
}
