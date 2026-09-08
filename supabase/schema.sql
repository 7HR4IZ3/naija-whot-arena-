-- Whot Arena data model
-- Run this once in Supabase SQL Editor, then enable Realtime for
-- public.room_players, public.rooms, and public.tournament_players.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Whot Player',
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Whot Player'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 4 and 8),
  name text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'classic' check (mode in ('classic', 'knockout', 'tournament')),
  status text not null default 'waiting' check (status in ('waiting', 'running', 'finished', 'cancelled')),
  max_players integer not null default 5 check (max_players between 2 and 5),
  rule_config jsonb not null default '{}'::jsonb,
  active_match_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  seat integer not null default 1 check (seat between 1 and 5),
  ready boolean not null default false,
  connected boolean not null default true,
  joined_at timestamptz not null default timezone('utc', now()),
  unique (room_id, user_id),
  unique (room_id, seat)
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  max_players integer not null default 16 check (max_players between 4 and 128),
  rule_config jsonb not null default '{}'::jsonb,
  status text not null default 'registration' check (status in ('registration', 'running', 'finished', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tournament_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  seed integer,
  status text not null default 'registered' check (status in ('registered', 'active', 'eliminated', 'winner', 'withdrawn')),
  joined_at timestamptz not null default timezone('utc', now()),
  unique (tournament_id, user_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  round_no integer not null default 1,
  status text not null default 'waiting' check (status in ('waiting', 'running', 'finished')),
  turn_seat integer,
  direction smallint not null default 1 check (direction in (-1, 1)),
  top_card jsonb,
  deck jsonb not null default '[]'::jsonb,
  discard jsonb not null default '[]'::jsonb,
  called_suit text,
  pending_penalty integer not null default 0,
  winner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.rooms
  drop constraint if exists rooms_active_match_id_fkey;
alter table public.rooms
  add constraint rooms_active_match_id_fkey foreign key (active_match_id) references public.matches(id) on delete set null;

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  seat integer not null,
  hand jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  connected boolean not null default true,
  unique (match_id, user_id),
  unique (match_id, seat)
);

create table if not exists public.match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists rooms_status_created_at_idx on public.rooms(status, created_at desc);
create index if not exists room_players_room_id_idx on public.room_players(room_id);
create index if not exists tournaments_status_starts_at_idx on public.tournaments(status, starts_at);
create index if not exists tournament_players_tournament_id_idx on public.tournament_players(tournament_id);
create index if not exists match_events_match_id_created_at_idx on public.match_events(match_id, created_at);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at before update on public.rooms for each row execute procedure public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at before update on public.tournaments for each row execute procedure public.set_updated_at();
drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at before update on public.matches for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_events enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_write_own on public.profiles;
create policy profiles_write_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists rooms_read_open_or_host on public.rooms;
create policy rooms_read_open_or_host on public.rooms for select to authenticated using (status = 'waiting' or host_id = auth.uid());
drop policy if exists rooms_create_host on public.rooms;
create policy rooms_create_host on public.rooms for insert to authenticated with check (host_id = auth.uid());
drop policy if exists rooms_update_host on public.rooms;
create policy rooms_update_host on public.rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists rooms_delete_host on public.rooms;
create policy rooms_delete_host on public.rooms for delete to authenticated using (host_id = auth.uid());

drop policy if exists room_players_read_waiting on public.room_players;
create policy room_players_read_waiting on public.room_players for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.rooms where rooms.id = room_players.room_id and (rooms.status = 'waiting' or rooms.host_id = auth.uid()))
);
drop policy if exists room_players_join_self on public.room_players;
create policy room_players_join_self on public.room_players for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.rooms where rooms.id = room_players.room_id and rooms.status = 'waiting')
);
drop policy if exists room_players_update_self_or_host on public.room_players;
create policy room_players_update_self_or_host on public.room_players for update to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.rooms where rooms.id = room_players.room_id and rooms.host_id = auth.uid())
) with check (user_id = auth.uid() or exists (select 1 from public.rooms where rooms.id = room_players.room_id and rooms.host_id = auth.uid()));
drop policy if exists room_players_leave_self_or_host on public.room_players;
create policy room_players_leave_self_or_host on public.room_players for delete to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.rooms where rooms.id = room_players.room_id and rooms.host_id = auth.uid())
);

drop policy if exists tournaments_read_registration_or_host on public.tournaments;
create policy tournaments_read_registration_or_host on public.tournaments for select to authenticated using (status in ('registration', 'running') or host_id = auth.uid());
drop policy if exists tournaments_create_host on public.tournaments;
create policy tournaments_create_host on public.tournaments for insert to authenticated with check (host_id = auth.uid());
drop policy if exists tournaments_update_host on public.tournaments;
create policy tournaments_update_host on public.tournaments for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists tournaments_delete_host on public.tournaments;
create policy tournaments_delete_host on public.tournaments for delete to authenticated using (host_id = auth.uid());

drop policy if exists tournament_players_read_open on public.tournament_players;
create policy tournament_players_read_open on public.tournament_players for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.tournaments where tournaments.id = tournament_players.tournament_id and (tournaments.status in ('registration', 'running') or tournaments.host_id = auth.uid()))
);
drop policy if exists tournament_players_join_self on public.tournament_players;
create policy tournament_players_join_self on public.tournament_players for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.tournaments where tournaments.id = tournament_players.tournament_id and tournaments.status = 'registration')
);
drop policy if exists tournament_players_update_self_or_host on public.tournament_players;
create policy tournament_players_update_self_or_host on public.tournament_players for update to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.tournaments where tournaments.id = tournament_players.tournament_id and tournaments.host_id = auth.uid())
) with check (user_id = auth.uid() or exists (select 1 from public.tournaments where tournaments.id = tournament_players.tournament_id and tournaments.host_id = auth.uid()));

drop policy if exists matches_read_participants on public.matches;
create policy matches_read_participants on public.matches for select to authenticated using (
  exists (select 1 from public.match_players where match_players.match_id = matches.id and match_players.user_id = auth.uid())
);
drop policy if exists matches_create_authenticated on public.matches;
create policy matches_create_authenticated on public.matches for insert to authenticated with check (true);
drop policy if exists matches_update_participants on public.matches;
create policy matches_update_participants on public.matches for update to authenticated using (
  exists (select 1 from public.match_players where match_players.match_id = matches.id and match_players.user_id = auth.uid())
);
drop policy if exists match_players_read_own on public.match_players;
create policy match_players_read_own on public.match_players for select to authenticated using (user_id = auth.uid());
drop policy if exists match_players_insert_own on public.match_players;
create policy match_players_insert_own on public.match_players for insert to authenticated with check (user_id = auth.uid());
drop policy if exists match_players_update_own on public.match_players;
create policy match_players_update_own on public.match_players for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists match_events_read_participants on public.match_events;
create policy match_events_read_participants on public.match_events for select to authenticated using (
  exists (select 1 from public.match_players where match_players.match_id = match_events.match_id and match_players.user_id = auth.uid())
);
drop policy if exists match_events_insert_participants on public.match_events;
create policy match_events_insert_participants on public.match_events for insert to authenticated with check (actor_id = auth.uid());

-- Realtime is intentionally enabled from the dashboard because Supabase projects
-- differ in whether these tables are already members of supabase_realtime.
-- alter publication supabase_realtime add table public.rooms;
-- alter publication supabase_realtime add table public.room_players;
-- alter publication supabase_realtime add table public.tournament_players;
