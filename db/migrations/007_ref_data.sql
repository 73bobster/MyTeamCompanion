-- Club and player reference data, copied from the shared football-data database by importer/refdata.mjs.
-- Read-only for the app (select for signed-in users and guests); only the owner role (the sync job) writes.
create table if not exists public.pro_clubs (
  slug text primary key, ref_id bigint not null, name text not null, short_name text, code text,
  venue text, city text, capacity int, founded int, logo_url text, updated_at timestamptz not null default now());
create table if not exists public.pro_squad (
  slug text not null, season int not null, ref_player_id bigint not null,
  name text not null, name_key text, position text, shirt int, nationality text, birth_date date,
  height_cm int, photo_url text, on_loan boolean not null default false,
  primary key (slug, season, ref_player_id));
create table if not exists public.pro_player_stats (
  slug text not null, season int not null, comp_id bigint not null, ref_player_id bigint not null,
  appearances int, starts int, minutes int, goals int, assists int, yellow int, red int,
  clean_sheets int, goals_conceded int, saves int, rating numeric,
  primary key (slug, season, comp_id, ref_player_id));
create table if not exists public.pro_competitions (comp_id bigint primary key, name text not null, nation_code text);
alter table public.pro_clubs enable row level security;
alter table public.pro_squad enable row level security;
alter table public.pro_player_stats enable row level security;
alter table public.pro_competitions enable row level security;
do $$ declare t text; begin
  foreach t in array array['pro_clubs','pro_squad','pro_player_stats','pro_competitions'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select to authenticated, anonymous using (true)', t||'_read', t);
    execute format('grant select on public.%I to authenticated, anonymous', t);
  end loop;
end $$;
create index if not exists pro_squad_slug on public.pro_squad (slug, season);
create index if not exists pro_player_stats_slug on public.pro_player_stats (slug, season);
