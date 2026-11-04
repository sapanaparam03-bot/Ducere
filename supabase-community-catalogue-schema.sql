-- Ducere community catalogue foundation.
-- DRAFT ONLY: production application is blocked until live schema inspection + backup.
-- Existing profiles and user_titles are intentionally untouched.

create extension if not exists pgcrypto;

create table if not exists public.catalogue_titles (
 id text primary key,
 canonical_title text not null check(length(trim(canonical_title)) between 1 and 300),
 original_title text,
 media_type text not null check(media_type in ('movie','tv','anime')),
 release_year int check(release_year is null or release_year between 1888 and 2200),
 release_date date, original_language text, country_of_origin char(2),
 synopsis text,
 synopsis_rights text not null default 'original' check(synopsis_rights in ('original','licensed','not_provided')),
 maturity_rating text, maturity_rating_source text,
 record_status text not null default 'pending' check(record_status in ('pending','approved','rejected','merged','archived')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.catalogue_title_aliases (
 id bigint generated always as identity primary key,
 title_id text not null references public.catalogue_titles(id) on delete cascade,
 alias text not null check(length(trim(alias)) between 1 and 300),
 language_code text, region_code char(2),
 alias_type text not null default 'alternate' check(alias_type in ('original','alternate','translated','abbreviation')),
 created_at timestamptz not null default now(),
 unique(title_id,alias,language_code,region_code)
);

create table if not exists public.catalogue_genres (
 id bigint generated always as identity primary key, name text not null unique, slug text not null unique
);
create table if not exists public.catalogue_title_genres (
 title_id text not null references public.catalogue_titles(id) on delete cascade,
 genre_id bigint not null references public.catalogue_genres(id) on delete restrict,
 primary key(title_id,genre_id)
);

create table if not exists public.catalogue_seasons (
 id text primary key, title_id text not null references public.catalogue_titles(id) on delete cascade,
 season_number int not null check(season_number >= 0), season_title text, release_date date,
 unique(title_id,season_number)
);
create table if not exists public.catalogue_episodes (
 id text primary key, title_id text not null references public.catalogue_titles(id) on delete cascade,
 season_id text not null references public.catalogue_seasons(id) on delete cascade,
 episode_number int not null check(episode_number >= 0), episode_title text, air_date date,
 runtime_minutes int check(runtime_minutes is null or runtime_minutes between 1 and 1000),
 unique(season_id,episode_number)
);

create table if not exists public.streaming_providers (
 id text primary key, display_name text not null unique, official_website_url text,
 supported_countries char(2)[] not null default '{}', is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(official_website_url is null or official_website_url ~ '^https://')
);

create table if not exists public.availability_claims (
 id uuid primary key default gen_random_uuid(),
 title_id text not null references public.catalogue_titles(id) on delete restrict,
 country_code char(2) not null check(country_code in ('IN','US','GB','CA','DE','AU')),
 provider_id text not null references public.streaming_providers(id) on delete restrict,
 access_type text not null check(access_type in ('subscription','ads','free','rent','buy')),
 official_url text,
 claim_status text not null default 'pending' check(claim_status in ('pending','verified','contested','rejected','expired','removed')),
 first_reported_at timestamptz not null default now(), last_verified_at timestamptz, expires_at timestamptz,
 confidence smallint check(confidence is null or confidence between 0 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(official_url is null or official_url ~ '^https://'),
 check(claim_status <> 'verified' or (last_verified_at is not null and expires_at is not null))
);

create table if not exists public.availability_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_user_id uuid not null references auth.users(id) on delete cascade,
 title_id text not null references public.catalogue_titles(id) on delete restrict,
 country_code char(2) not null check(country_code in ('IN','US','GB','CA','DE','AU')),
 provider_id text not null references public.streaming_providers(id) on delete restrict,
 action text not null check(action in ('add','remove','change')),
 proposed_access_type text check(proposed_access_type is null or proposed_access_type in ('subscription','ads','free','rent','buy')),
 proposed_official_url text, reason text not null check(length(trim(reason)) between 5 and 2000),
 report_status text not null default 'pending' check(report_status in ('pending','under_review','accepted','rejected','withdrawn')),
 reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(proposed_official_url is null or proposed_official_url ~ '^https://')
);

create table if not exists public.availability_evidence (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.availability_reports(id) on delete cascade,
 submitted_by uuid not null references auth.users(id) on delete cascade,
 evidence_url text not null check(evidence_url ~ '^https://'), evidence_note text,
 review_result text not null default 'unreviewed' check(review_result in ('unreviewed','accepted','rejected')),
 created_at timestamptz not null default now()
);
create table if not exists public.availability_votes (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.availability_reports(id) on delete cascade,
 voter_user_id uuid not null references auth.users(id) on delete cascade,
 vote text not null check(vote in ('confirm','dispute')), reason text,
 created_at timestamptz not null default now(), unique(report_id,voter_user_id)
);
create table if not exists public.catalogue_moderation_actions (
 id uuid primary key default gen_random_uuid(),
 moderator_user_id uuid references auth.users(id) on delete set null,
 report_id uuid references public.availability_reports(id) on delete set null,
 claim_id uuid references public.availability_claims(id) on delete set null,
 action text not null, reason text not null, created_at timestamptz not null default now(),
 check(report_id is not null or claim_id is not null)
);
create table if not exists public.catalogue_change_history (
 id bigint generated always as identity primary key, entity_type text not null, entity_id text not null,
 old_values jsonb, new_values jsonb, actor_user_id uuid references auth.users(id) on delete set null,
 change_reason text, created_at timestamptz not null default now()
);
create table if not exists public.contributor_reputation (
 user_id uuid primary key references auth.users(id) on delete cascade,
 trust_score int not null default 0 check(trust_score >= 0),
 accepted_reports int not null default 0 check(accepted_reports >= 0),
 rejected_reports int not null default 0 check(rejected_reports >= 0),
 moderation_state text not null default 'normal' check(moderation_state in ('normal','limited','suspended')),
 updated_at timestamptz not null default now()
);
create table if not exists public.catalogue_import_batches (
 id uuid primary key default gen_random_uuid(), dataset_name text not null, source_url text,
 licence_name text not null, licence_url text, permitted_use_review text not null,
 reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz,
 imported_at timestamptz, retention_until timestamptz,
 batch_status text not null default 'proposed' check(batch_status in ('proposed','approved','imported','rejected','expired')),
 created_at timestamptz not null default now()
);

create index if not exists catalogue_titles_search_idx on public.catalogue_titles using gin(to_tsvector('simple',canonical_title));
create index if not exists catalogue_titles_type_year_idx on public.catalogue_titles(media_type,release_year desc);
create index if not exists catalogue_aliases_title_idx on public.catalogue_title_aliases(title_id);
create index if not exists availability_country_title_idx on public.availability_claims(country_code,title_id,claim_status);
create index if not exists availability_provider_idx on public.availability_claims(provider_id,country_code,claim_status);
create index if not exists availability_expiry_idx on public.availability_claims(expires_at) where claim_status='verified';
create index if not exists availability_reports_queue_idx on public.availability_reports(report_status,created_at);

-- Enable RLS on every new public table.
alter table public.catalogue_titles enable row level security;
alter table public.catalogue_title_aliases enable row level security;
alter table public.catalogue_genres enable row level security;
alter table public.catalogue_title_genres enable row level security;
alter table public.catalogue_seasons enable row level security;
alter table public.catalogue_episodes enable row level security;
alter table public.streaming_providers enable row level security;
alter table public.availability_claims enable row level security;
alter table public.availability_reports enable row level security;
alter table public.availability_evidence enable row level security;
alter table public.availability_votes enable row level security;
alter table public.catalogue_moderation_actions enable row level security;
alter table public.catalogue_change_history enable row level security;
alter table public.contributor_reputation enable row level security;
alter table public.catalogue_import_batches enable row level security;

-- Public reads: approved catalogue only and verified availability that has not expired.
create policy "approved titles readable" on public.catalogue_titles for select to anon,authenticated using(record_status='approved');
create policy "approved aliases readable" on public.catalogue_title_aliases for select to anon,authenticated using(
 exists(select 1 from public.catalogue_titles t where t.id=title_id and t.record_status='approved'));
create policy "genres readable" on public.catalogue_genres for select to anon,authenticated using(true);
create policy "approved title genres readable" on public.catalogue_title_genres for select to anon,authenticated using(
 exists(select 1 from public.catalogue_titles t where t.id=title_id and t.record_status='approved'));
create policy "approved seasons readable" on public.catalogue_seasons for select to anon,authenticated using(
 exists(select 1 from public.catalogue_titles t where t.id=title_id and t.record_status='approved'));
create policy "approved episodes readable" on public.catalogue_episodes for select to anon,authenticated using(
 exists(select 1 from public.catalogue_titles t where t.id=title_id and t.record_status='approved'));
create policy "active providers readable" on public.streaming_providers for select to anon,authenticated using(is_active);
create policy "verified fresh claims readable" on public.availability_claims for select to anon,authenticated using(
 claim_status='verified' and expires_at > now());

-- Contributors may read/submit their own reports and evidence; no client moderation rights.
create policy "own reports readable" on public.availability_reports for select to authenticated using(reporter_user_id=(select auth.uid()));
create policy "own reports insert" on public.availability_reports for insert to authenticated with check(reporter_user_id=(select auth.uid()));
create policy "own evidence readable" on public.availability_evidence for select to authenticated using(
 exists(select 1 from public.availability_reports r where r.id=report_id and r.reporter_user_id=(select auth.uid())));
create policy "own evidence insert" on public.availability_evidence for insert to authenticated with check(
 submitted_by=(select auth.uid()) and exists(select 1 from public.availability_reports r where r.id=report_id and r.reporter_user_id=(select auth.uid())));
create policy "own votes readable" on public.availability_votes for select to authenticated using(voter_user_id=(select auth.uid()));
create policy "vote on other users reports" on public.availability_votes for insert to authenticated with check(
 voter_user_id=(select auth.uid()) and not exists(select 1 from public.availability_reports r where r.id=report_id and r.reporter_user_id=(select auth.uid())));
create policy "own reputation readable" on public.contributor_reputation for select to authenticated using(user_id=(select auth.uid()));

-- Intentionally no client write policies for canonical catalogue, claims, moderation,
-- history, reputation, or import batches. Trusted server-side workflows are required.
