-- Ducere community-powered streaming availability (proposal; not applied).
-- No third-party availability provider is used. Reports are user claims and stay
-- pending until a trusted moderator verifies them. Evidence URLs are never fetched
-- server-side, preventing SSRF and avoiding scraping provider pages.

create table if not exists public.streaming_providers (
  id text primary key,
  display_name text not null,
  official_home_url text not null check (official_home_url ~ '^https://'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_reports (
  id uuid primary key default gen_random_uuid(),
  title_id text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  provider_id text not null references public.streaming_providers(id),
  action text not null check (action in ('add','remove','change_access')),
  access_type text check (access_type in ('subscription','ads','free','rent','buy')),
  official_title_url text check (official_title_url is null or official_title_url ~ '^https://'),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  reason text not null check (char_length(trim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','verified','contested','rejected','expired')),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_votes (
  report_id uuid not null references public.availability_reports(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('confirm','dispute')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (report_id, voter_id)
);

create table if not exists public.availability_claims (
  id uuid primary key default gen_random_uuid(),
  title_id text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  provider_id text not null references public.streaming_providers(id),
  access_type text not null check (access_type in ('subscription','ads','free','rent','buy')),
  official_title_url text not null check (official_title_url ~ '^https://'),
  status text not null default 'pending' check (status in ('pending','verified','contested','expired','removed')),
  first_reported_at timestamptz not null default now(),
  last_verified_at timestamptz,
  expires_at timestamptz,
  source_report_id uuid references public.availability_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title_id, country_code, provider_id, access_type, official_title_url)
);

create index if not exists availability_reports_owner_idx
  on public.availability_reports (reporter_id, created_at desc);
create index if not exists availability_reports_review_idx
  on public.availability_reports (status, created_at);
create index if not exists availability_votes_report_idx
  on public.availability_votes (report_id);
create index if not exists availability_claims_lookup_idx
  on public.availability_claims (title_id, country_code, status, expires_at);

alter table public.streaming_providers enable row level security;
alter table public.availability_reports enable row level security;
alter table public.availability_votes enable row level security;
alter table public.availability_claims enable row level security;

-- Public users see only verified, unexpired claims and active provider names.
drop policy if exists "active providers are readable" on public.streaming_providers;
create policy "active providers are readable"
  on public.streaming_providers for select to anon, authenticated using (active = true);

drop policy if exists "verified current availability is readable" on public.availability_claims;
create policy "verified current availability is readable"
  on public.availability_claims for select to anon, authenticated
  using (status = 'verified' and expires_at > now() and last_verified_at is not null);

-- Reporters can see their own reports; no client can set status/reviewer fields.
drop policy if exists "reporters can read own reports" on public.availability_reports;
create policy "reporters can read own reports"
  on public.availability_reports for select to authenticated using (reporter_id = auth.uid());

drop policy if exists "authenticated users can submit reports" on public.availability_reports;
create policy "authenticated users can submit reports"
  on public.availability_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists "reporters can read votes on own reports" on public.availability_votes;
create policy "reporters can read votes on own reports"
  on public.availability_votes for select to authenticated
  using (
    voter_id = auth.uid()
    or exists (
      select 1 from public.availability_reports r
      where r.id = report_id and r.reporter_id = auth.uid()
    )
  );

drop policy if exists "authenticated users can vote once" on public.availability_votes;
create policy "authenticated users can vote once"
  on public.availability_votes for insert to authenticated
  with check (
    voter_id = auth.uid()
    and not exists (
      select 1 from public.availability_reports r
      where r.id = report_id and r.reporter_id = auth.uid()
    )
  );

-- No browser UPDATE/DELETE policies. Trusted server-side moderation must use
-- a narrowly scoped function/RPC with role checks and an audit trail before
-- changing a report or publishing a verified claim.

revoke all on public.streaming_providers from public, anon, authenticated;
revoke all on public.availability_reports from public, anon, authenticated;
revoke all on public.availability_votes from public, anon, authenticated;
revoke all on public.availability_claims from public, anon, authenticated;

grant select on public.streaming_providers to anon, authenticated;
grant select on public.availability_claims to anon, authenticated;
grant select, insert on public.availability_reports to authenticated;
grant select, insert on public.availability_votes to authenticated;
