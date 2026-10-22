-- Octaspan threat archive. Run once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists public.threat_reports (
  id            text primary key,
  published_at  timestamptz not null,
  first_seen_at timestamptz not null default now(),
  source_id     text not null,
  source_name   text,
  title         text not null,
  url           text not null,
  kind          text,
  sector        text,
  primary_attack text,
  attack_types  text[] default '{}',
  severity      text,
  verification  text,
  country       text,
  region        text,
  is_apt        boolean default false,
  exploited     boolean default false,
  cves          text[] default '{}',
  actors        text[] default '{}',
  financial     jsonb,
  excerpt       text
);
create index if not exists threat_reports_published_idx on public.threat_reports (published_at desc);
create index if not exists threat_reports_sector_idx   on public.threat_reports (sector, published_at desc);

-- Row Level Security ON with no public policies: the browser (anon key) can read/write nothing.
-- Only the Netlify functions, using the service-role key, can access the data.
alter table public.threat_reports enable row level security;

-- Daily roll-up used by /api/threat/history (counts reports, not de-duplicated incidents).
create or replace view public.threat_daily with (security_invoker = true) as
select (published_at at time zone 'UTC')::date as day,
       sector, primary_attack, severity, verification, region,
       count(*) as reports,
       count(*) filter (where is_apt) as apt_reports,
       count(*) filter (where exploited) as exploited_reports
from public.threat_reports
group by 1,2,3,4,5,6;

-- Optional housekeeping: keep ~13 months. Run on a schedule (Database > Cron) or manually.
-- delete from public.threat_reports where published_at < now() - interval '400 days';
