# Live Threat Snapshot: architecture and operations

Page: `threat-snapshot.html` (assets: `assets/threat.css`, `assets/threat.js`). Hosted on Netlify with Netlify Functions and Netlify Blobs as the datastore. No separate server or database is needed.

## How it works
1. **Ingestion** (`netlify/functions/threat-ingest.mjs`): a scheduled function runs every 3 hours (`0 */3 * * *`). It loads the source registry, fetches each enabled source (official RSS/Atom feeds, plus the SEC EDGAR full-text search API for 8-K Item 1.05 filings), classifies each item, de-duplicates into incidents, and stores the last 35 days of reports.
2. **API** (`/api/threat/snapshot`): computes KPIs, charts, feed, trends, financial panel and source health from the stored reports for the selected window and filters. `/api/threat/refresh` (POST) runs an ingestion on demand, limited to one run per 10 minutes.
3. **Dashboard**: renders the API response; nothing on the page is hardcoded. It re-fetches every 3 hours while open.

If the store is empty (first visit after the first deploy) the API runs one ingestion itself so the page is never blank.

## Sources (SRC-01..10)
Defined in `netlify/functions/lib/sources.mjs`; the registry is copied into the datastore on first run, so a source can be enabled, disabled or re-pointed there without redeploying code. Each record has: source_id, name, base_url, source_type, ingestion_method, feed_or_api_url, enabled, polling_interval_minutes, attribution_required, redistribution_policy, rate_limit_configuration. Run state (last_attempt_at, last_success_at, last_error) is kept per source.

| ID | Source | Method |
|---|---|---|
| SRC-01 | BleepingComputer | RSS |
| SRC-02 | The Record | RSS |
| SRC-03 | SecurityWeek | RSS (FeedBurner) |
| SRC-04 | The Hacker News | RSS (FeedBurner) |
| SRC-05 | Reuters | **Link-only** (no permitted public feed) |
| SRC-06 | CISA Cybersecurity Advisories | RSS |
| SRC-07 | CERT-In | **Link-only** until an official feed URL is confirmed |
| SRC-08 | Microsoft Threat Intelligence | RSS |
| SRC-09 | Mandiant / Google Cloud Threat Intelligence | RSS |
| SRC-10 | SEC EDGAR | Full-text search API, Form 8-K Item 1.05, identified User-Agent, one request per run |

Nothing is scraped, and no paywall, rate limit or access control is bypassed. Only the headline, a short excerpt (about two sentences) and the link to the original publisher are stored and shown. To enable CERT-In or another source once a feed is confirmed, set `ingestion_method: 'rss'`, `feed_or_api_url` and `enabled: true` for it. Feed URLs should be re-verified from time to time, because publishers change them.

## Counting rules
See the "Methodology & sources" section on the page. In short: incidents are de-duplicated across outlets (shared CVE, or similar headlines within 5 days); "confirmed" needs a first-party source or the organization's own confirmation; financial totals use only directly disclosed, reported amounts per currency and exclude ransom demands, estimates and allegations; period-over-period change is shown only after two full windows of data; severity is an automated estimate.

## Limits to be aware of
- Classification is keyword/rule based, so some items will be mis-sectored or mis-typed. Headline text drives most decisions.
- Feeds only expose their most recent items, so history builds up over time and 30-day views stay thin for the first weeks.
- Reuters and CERT-In are not ingested automatically; no manual-entry form has been built (the chosen approach is link-only).
- Netlify scheduled functions run only on the published (production) deploy.

## Tests
`npm test` runs unit and end-to-end tests (parsers, classifier, de-duplication, aggregation, financial rules, failure isolation) using fixtures; no network is needed.

## Long-term archive (optional, Supabase)

The live dashboard keeps 35 days in Netlify Blobs. To keep ~1 year for analytics, every new report is also
copied into a Supabase Postgres table after each 3-hourly ingest.

1. Create a free project at supabase.com. In the SQL Editor run `supabase/schema.sql`.
2. In Netlify: Site configuration > Environment variables, add `SUPABASE_URL` (Project Settings > API > Project URL)
   and `SUPABASE_SERVICE_KEY` (the `service_role` key — server-side only, never in front-end code). Redeploy.
3. `GET /api/threat/history?days=365` returns daily roll-ups (`threat_daily`) for 12-month trend charts;
   raw rows live in `threat_reports` (query with SQL, Metabase, Looker Studio, etc.).

Notes: ~100–300 reports/day is roughly 50–150 MB/year, inside the free 500 MB. Free projects pause after 7 days
without activity; the 3-hourly writes keep it active. Roll-ups count reports, not de-duplicated incidents.
Archive failures are logged in the ingest summary (`archiveError`) and never stop ingestion.
