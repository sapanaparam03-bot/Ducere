-- Ducere production database. Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Viewer',
  country text not null default 'IN',
  appearance text not null default 'night' check (appearance in ('night','day')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_titles (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null,
  status text not null check (status in ('watchlist','watching','watched')),
  date_added date not null default current_date,
  date_watched date,
  rating smallint check (rating between 1 and 5),
  review text,
  current_season integer,
  current_episode integer,
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id,title_id)
);

alter table public.profiles enable row level security;
alter table public.user_titles enable row level security;

drop policy if exists "profiles own row" on public.profiles;
create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "titles own rows" on public.user_titles;
create policy "titles own rows" on public.user_titles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username) values (new.id, coalesce(new.raw_user_meta_data->>'username','Viewer'));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
