-- Ducere shared catalogue foundation (proposal; not yet applied to Supabase).
-- Review provider licensing before importing/caching any provider's data.
-- Use stable IDs such as "tmdb:movie:123" or "tmdb:tv:456" so existing
-- public.user_titles.title_id can reference catalogue IDs without a breaking migration.

create extension if not exists pgcrypto;

create table if not exists public.catalogue_titles (
  id text primary key,
  source text not null,
  source_id text not null,
  source_license text,
  source_url text,
  license_reviewed_at timestamptz,
  expires_at timestamptz,
  media_type text not null check (media_type in ('movie', 'tv', 'anime')),
  title text not null,
  original_title text,
  overview text,
  release_date date,
  poster_path text,
  backdrop_path text,
  original_language text,
  genres text[] not null default '{}',
  popularity numeric,
  source_metadata jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  cached_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists catalogue_titles_title_search_idx
  on public.catalogue_titles using gin (to_tsvector('simple', title));
create index if not exists catalogue_titles_type_release_idx
  on public.catalogue_titles (media_type, release_date desc);
create index if not exists catalogue_titles_source_idx
  on public.catalogue_titles (source, source_id);

create table if not exists public.catalogue_external_ids (
  title_id text not null references public.catalogue_titles(id) on delete cascade,
  provider text not null,
  external_id text not null,
  primary key (provider, external_id),
  unique (title_id, provider)
);

create table if not exists public.catalogue_seasons (
  id text primary key,
  title_id text not null references public.catalogue_titles(id) on delete cascade,
  season_number integer not null,
  name text,
  overview text,
  air_date date,
  poster_path text,
  source_metadata jsonb not null default '{}'::jsonb,
  unique (title_id, season_number)
);

create table if not exists public.catalogue_episodes (
  id text primary key,
  title_id text not null references public.catalogue_titles(id) on delete cascade,
  season_id text references public.catalogue_seasons(id) on delete cascade,
  season_number integer not null,
  episode_number integer not null,
  name text,
  overview text,
  air_date date,
  still_path text,
  runtime_minutes integer,
  source_metadata jsonb not null default '{}'::jsonb,
  unique (title_id, season_number, episode_number)
);

create table if not exists public.catalogue_streaming_availability (
  id bigint generated always as identity primary key,
  title_id text not null references public.catalogue_titles(id) on delete cascade,
  country_code char(2) not null,
  provider_id text not null,
  provider_name text not null,
  access_type text,
  web_url text,
  source text not null,
  checked_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (title_id, country_code, provider_id, access_type, source)
);

create index if not exists catalogue_availability_country_title_idx
  on public.catalogue_streaming_availability (country_code, title_id);
create index if not exists catalogue_availability_expiry_idx
  on public.catalogue_streaming_availability (expires_at);

-- Public catalogue reads only. Do not grant browser clients permission to insert/update.
-- A trusted server-side job should perform imports and refreshes using a secret key
-- kept server-side only (never in VITE_ environment variables).
alter table public.catalogue_titles enable row level security;
alter table public.catalogue_external_ids enable row level security;
alter table public.catalogue_seasons enable row level security;
alter table public.catalogue_episodes enable row level security;
alter table public.catalogue_streaming_availability enable row level security;

drop policy if exists "catalogue titles are readable" on public.catalogue_titles;
create policy "catalogue titles are readable"
  on public.catalogue_titles for select to anon, authenticated using (true);
drop policy if exists "catalogue external ids are readable" on public.catalogue_external_ids;
create policy "catalogue external ids are readable"
  on public.catalogue_external_ids for select to anon, authenticated using (true);
drop policy if exists "catalogue seasons are readable" on public.catalogue_seasons;
create policy "catalogue seasons are readable"
  on public.catalogue_seasons for select to anon, authenticated using (true);
drop policy if exists "catalogue episodes are readable" on public.catalogue_episodes;
create policy "catalogue episodes are readable"
  on public.catalogue_episodes for select to anon, authenticated using (true);
drop policy if exists "catalogue availability is readable" on public.catalogue_streaming_availability;
create policy "catalogue availability is readable"
  on public.catalogue_streaming_availability for select to anon, authenticated using (true);

-- Deliberately no INSERT/UPDATE/DELETE policies for anon/authenticated:
-- provider imports and refreshes must run through a trusted backend.

-- RLS policies control rows; explicit SELECT grants make the intended read-only
-- Data API access clear when project-level default grants are restricted.
grant select on public.catalogue_titles to anon, authenticated;
grant select on public.catalogue_external_ids to anon, authenticated;
grant select on public.catalogue_seasons to anon, authenticated;
grant select on public.catalogue_episodes to anon, authenticated;
grant select on public.catalogue_streaming_availability to anon, authenticated;
