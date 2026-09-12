-- Whot Arena: complete database setup. Run in Supabase SQL Editor.
-- Includes the base schema and secure multiplayer migration in one transaction.
begin;
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
  mode text not null default 'classic' check (mode in ('classic', 'knockout', 'tender', 'tournament')),
  status text not null default 'waiting' check (status in ('waiting', 'running', 'finished', 'cancelled')),
  max_players integer not null default 5 check (max_players between 2 and 8),
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
  seat integer not null default 1 check (seat between 1 and 8),
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

-- Apply AFTER supabase/schema.sql. All gameplay writes go through arena().
create schema if not exists arena_private;
revoke all on schema arena_private from public, anon, authenticated;

create table if not exists arena_private.games (
 id uuid primary key default gen_random_uuid(), room_id uuid references public.rooms(id),
 tournament_id uuid references public.tournaments(id), round_no int not null default 1,
 state jsonb not null, version int not null default 1, updated_at timestamptz not null default now()
);
create table if not exists arena_private.requests (
 user_id uuid not null, request_id uuid not null, result jsonb not null,
 created_at timestamptz default now(), primary key(user_id,request_id)
);
create table if not exists arena_private.results (
 game_id uuid not null references arena_private.games(id), user_id uuid not null,
 score int not null, won boolean not null, created_at timestamptz default now(), primary key(game_id,user_id)
);
create table if not exists arena_private.visits (
 room_id uuid not null, user_id uuid not null, seen_at timestamptz default now(), primary key(room_id,user_id)
);
create index if not exists arena_games_room on arena_private.games(room_id);
create index if not exists arena_games_tournament on arena_private.games(tournament_id,round_no);
create table if not exists public.arena_updates (
 id uuid primary key, room_id uuid, tournament_id uuid, revision int not null default 0
);
alter table public.arena_updates enable row level security;
drop policy if exists arena_updates_read on public.arena_updates;
create policy arena_updates_read on public.arena_updates for select to authenticated using (
 exists(select 1 from public.room_players p where p.room_id=arena_updates.room_id and p.user_id=auth.uid())
 or exists(select 1 from public.tournament_players p where p.tournament_id=arena_updates.tournament_id and p.user_id=auth.uid())
);
grant select on public.arena_updates to authenticated;
revoke insert, update, delete on public.arena_updates from anon, authenticated;
-- Legacy policies must not permit bypassing server validation or reading a deck.
revoke all on public.matches,public.match_players,public.match_events from anon,authenticated;
revoke insert,update,delete on public.rooms,public.room_players,public.tournaments,public.tournament_players from anon,authenticated;
drop policy if exists tournaments_read_registration_or_host on public.tournaments;
create policy tournaments_read_registration_or_host on public.tournaments for select to authenticated using (true);
alter table public.profiles drop constraint if exists profiles_name_length;
alter table public.profiles add constraint profiles_name_length check (char_length(trim(display_name)) between 1 and 40) not valid;

create or replace function arena_private.ping(r uuid,t uuid) returns void language plpgsql as $$
begin
 insert into public.arena_updates(id,room_id,tournament_id) values(coalesce(r,t),r,t)
 on conflict(id) do update set revision=arena_updates.revision+1;
end $$;

create or replace function arena_private.rules(v jsonb) returns jsonb language plpgsql as $$
declare d jsonb := '{"gameType":"classic","initialHand":6,"drawMode":"one","emptyMarketMode":"score","turnTimer":"10","targetScore":100,"clockwise":true,"endCalls":true,"starDouble":true,"whotEnabled":true,"whotCallsSuit":true,"holdOnEnabled":true,"pickTwoEnabled":true,"pickTwoMode":"stack","pickThreeEnabled":true,"pickThreeMode":"stack","suspensionEnabled":true,"generalMarketEnabled":true}'; k text;
begin
 if v is null then return d; end if;
 if jsonb_typeof(v)<>'object' then raise exception 'Invalid rules'; end if;
 for k in select jsonb_object_keys(d) loop
  if v ? k then
   if jsonb_typeof(v->k)<>jsonb_typeof(d->k) then raise exception 'Invalid rule: %',k; end if;
   d:=jsonb_set(d,array[k],v->k);
  end if;
 end loop;
 if d->>'gameType' not in ('classic','knockout') or d->>'drawMode' not in ('one','until-playable') or d->>'emptyMarketMode' not in ('score','recycle')
 or d->>'turnTimer' not in ('off','10','15','30') or d->>'pickTwoMode' not in ('stack','block','none')
 or d->>'pickThreeMode' not in ('stack','block','none') or (d->>'initialHand')::int not between 3 and 6
 or (d->>'targetScore')::int not in (50,100,200) then raise exception 'Invalid rules'; end if;
 return d;
end $$;

create or replace function arena_private.shuffle(v jsonb) returns jsonb language sql as $$
 select coalesce(jsonb_agg(value order by gen_random_uuid()),'[]'::jsonb) from jsonb_array_elements(v)
$$;

create or replace function arena_private.deal(roster jsonb,rules jsonb,round_no int default 1) returns jsonb language plpgsql as $$
declare deck jsonb:='[]'; ps jsonb:='[]'; p jsonb; c jsonb; suit text; nums int[]; n int; i int; h jsonb;
begin
 foreach suit in array array['circle','triangle','cross','square','star','whot'] loop
  nums:=case when suit in ('circle','triangle') then array[1,2,3,4,5,7,8,10,11,12,13,14]
   when suit in ('cross','square') then array[1,2,3,5,7,10,11,13,14] when suit='star' then array[1,2,3,4,5,7,8] else array[20,20,20,20,20] end;
  for i in 1..array_length(nums,1) loop
   n:=nums[i];
   if suit<>'whot' or (rules->>'whotEnabled')::boolean then
    deck:=deck||jsonb_build_array(jsonb_build_object('id',suit||'-'||n||'-'||i,'suit',suit,'value',n,'score',case when suit='star' and (rules->>'starDouble')::boolean then n*2 else n end));
   end if;
  end loop;
 end loop;
 deck:=arena_private.shuffle(deck);
 for p in select value from jsonb_array_elements(roster) loop
  h:='[]';
  for i in 1..(rules->>'initialHand')::int loop h:=h||jsonb_build_array(deck->0); deck:=deck-0; end loop;
  ps:=ps||jsonb_build_array(p||jsonb_build_object('hand',h,'eliminated',false,'total',coalesce((p->>'total')::int,0)));
 end loop;
 -- Start on an ordinary card; no opening action or uncalled Whot.
 select value into c from jsonb_array_elements(deck) where (value->>'value')::int in (3,4,7,10,11,12,13) limit 1;
 select jsonb_agg(value) into deck from jsonb_array_elements(deck) where value->>'id'<>c->>'id';
 return jsonb_build_object('players',ps,'deck',deck,'discard',jsonb_build_array(c),'turn',0,'penalty',0,'penaltyType',0,
 'calledSuit',null,'rules',rules,'status','running','winner',null,'round',round_no,'passes',0,
 'message','Cards dealt. Your table is ready.','event',jsonb_build_object('type','deal'),'deadline',case when rules->>'turnTimer'='off' then null else now()+((rules->>'turnTimer')::int*interval '1 second') end);
end $$;

create or replace function arena_private.playable(s jsonb,c jsonb) returns boolean language plpgsql as $$
declare top jsonb:=s->'discard'->(jsonb_array_length(s->'discard')-1); mode text;
begin
 if (s->>'penalty')::int>0 then
  mode:=s->'rules'->>case when (s->>'penaltyType')::int=2 then 'pickTwoMode' else 'pickThreeMode' end;
  return mode<>'none' and (c->>'value')::int=(s->>'penaltyType')::int;
 end if;
 if c->>'suit'='whot' then return true; end if;
 if s->>'calledSuit' is not null then return c->>'suit'=s->>'calledSuit'; end if;
 return top->>'suit'='whot' or c->>'suit'=top->>'suit' or c->>'value'=top->>'value';
end $$;

create or replace function arena_private.next_player(s jsonb,idx int,steps int default 1) returns int language plpgsql as $$
declare n int:=jsonb_array_length(s->'players'); i int; direction int:=case when (s->'rules'->>'clockwise')::boolean then 1 else -1 end;
begin
 for i in 1..steps loop
  loop idx:=(idx+direction+n)%n; exit when not coalesce((s->'players'->idx->>'eliminated')::boolean,false); end loop;
 end loop; return idx;
end $$;

create or replace function arena_private.draw(s jsonb,idx int,amount int) returns jsonb language plpgsql as $$
declare d jsonb:=s->'deck'; pile jsonb:=s->'discard'; h jsonb:=s->'players'->idx->'hand'; i int;
begin
 for i in 1..amount loop
  if jsonb_array_length(d)=0 and jsonb_array_length(pile)>1 and coalesce(s->'rules'->>'emptyMarketMode','score')='recycle' then
   d:=arena_private.shuffle(pile-(jsonb_array_length(pile)-1)); pile:=jsonb_build_array(pile->(jsonb_array_length(pile)-1));
  end if;
  exit when jsonb_array_length(d)=0;
  h:=h||jsonb_build_array(d->0); d:=d-0;
 end loop;
 s:=jsonb_set(s,array['players',idx::text,'hand'],h);
 return s||jsonb_build_object('deck',d,'discard',pile);
end $$;

create or replace function arena_private.new_game(r uuid,t uuid,roster jsonb,rules jsonb,round_no int default 1) returns uuid language plpgsql as $$
declare gid uuid;
begin
 insert into arena_private.games(room_id,tournament_id,round_no,state) values(r,t,round_no,arena_private.deal(roster,rules,1)) returning id into gid;
 return gid;
end $$;

create or replace function arena_private.advance(t uuid) returns void language plpgsql as $$
declare rnd int; winners jsonb; roster jsonb; i int; g uuid; rules jsonb;
begin
 select max(round_no) into rnd from arena_private.games where tournament_id=t;
 if exists(select 1 from arena_private.games where tournament_id=t and round_no=rnd and state->>'status'='running') then return; end if;
 select jsonb_agg(p.value order by g.id) into winners from arena_private.games g cross join lateral jsonb_array_elements(g.state->'players') p
 where g.tournament_id=t and g.round_no=rnd and p.value->>'id'=g.state->>'winner';
 if jsonb_array_length(winners)=1 then
  update public.tournaments set status='finished' where id=t;
  update public.tournament_players set status=case when user_id=(winners->0->>'id')::uuid then 'winner' else 'eliminated' end where tournament_id=t;
  return;
 end if;
 select rule_config into rules from public.tournaments where id=t;
 i:=0;
 while i<jsonb_array_length(winners) loop
  roster:=jsonb_build_array((winners->i)-'hand'-'total');
  if i+1<jsonb_array_length(winners) then roster:=roster||jsonb_build_array((winners->(i+1))-'hand'-'total'); end if;
  g:=arena_private.new_game(null,t,roster,rules,rnd+1);
  if jsonb_array_length(roster)=1 then update arena_private.games set state=state||jsonb_build_object('status','finished','winner',roster->0->>'id','message','Bye — advanced to next round') where id=g; end if;
  i:=i+2;
 end loop;
end $$;

create or replace function arena_private.finish(gid uuid,s jsonb) returns jsonb language plpgsql as $$
declare p jsonb; i int:=0; score int; alive int; winner text:=s->>'winner'; roster jsonb; t uuid;
begin
 for p in select value from jsonb_array_elements(s->'players') loop
  select coalesce(sum((value->>'score')::int),0) into score from jsonb_array_elements(p->'hand');
  s:=jsonb_set(s,array['players',i::text,'roundScore'],to_jsonb(score));
  s:=jsonb_set(s,array['players',i::text,'total'],to_jsonb(coalesce((p->>'total')::int,0)+score));
  i:=i+1;
 end loop;
 if s->'rules'->>'gameType'='knockout' then
  i:=0;
  for p in select value from jsonb_array_elements(s->'players') loop
   if (p->>'total')::int>=(s->'rules'->>'targetScore')::int then s:=jsonb_set(s,array['players',i::text,'eliminated'],'true'); end if;
   i:=i+1;
  end loop;
  select count(*) into alive from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  if alive>1 then
   select jsonb_agg(value-'hand'-'roundScore') into roster from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
   -- Eliminated players remain in the match roster to view the rest of the series.
   declare fresh jsonb; eliminated jsonb; begin
    fresh:=arena_private.deal(roster,s->'rules',(s->>'round')::int+1);
    select coalesce(jsonb_agg(value||'{"hand":[]}'::jsonb),'[]') into eliminated from jsonb_array_elements(s->'players') where (value->>'eliminated')::boolean;
    return fresh||jsonb_build_object('players',(fresh->'players')||eliminated,'message','Round complete. Scores added; the next round is dealt.');
   end;
  end if;
  select value->>'id' into winner from jsonb_array_elements(s->'players') order by (value->>'total')::int,value->>'id' limit 1;
 end if;
 s:=s||jsonb_build_object('status','finished','winner',winner,'deadline',null);
 for p in select value from jsonb_array_elements(s->'players') loop
  insert into arena_private.results(game_id,user_id,score,won) values(gid,(p->>'id')::uuid,(p->>'total')::int,p->>'id'=winner) on conflict do nothing;
 end loop;
 select tournament_id into t from arena_private.games where id=gid;
 if t is not null then update public.tournament_players set status='eliminated' where tournament_id=t and user_id<>winner::uuid and user_id in(select (value->>'id')::uuid from jsonb_array_elements(s->'players')); end if;
 return s;
end $$;

create or replace function arena_private.move(gid uuid,uid uuid,a text,v jsonb) returns void language plpgsql as $$
declare g arena_private.games; s jsonb; idx int; actor int; c jsonb; h jsonb; n int; steps int:=1; mode text; before_count int; drawn int:=0; j int; active_count int; win text; event jsonb;
begin
 select * into g from arena_private.games where id=gid for update;
 if not found then raise exception 'Game not found'; end if;
 s:=g.state; idx:=(s->>'turn')::int;
 select ordinality::int-1 into actor from jsonb_array_elements(s->'players') with ordinality where value->>'id'=uid::text;
 if actor is null then raise exception 'You are not at this table'; end if;
 if s->>'status'<>'running' then raise exception 'This match has ended'; end if;
 if a='timeout' then
  if s->>'deadline' is null or now()<(s->>'deadline')::timestamptz then raise exception 'The turn has not expired'; end if;
 elsif (v->>'version')::int is distinct from g.version then raise exception 'Table changed. Try your move again.';
 elsif actor<>idx and a<>'forfeit' then raise exception 'It is not your turn';
 elsif a<>'forfeit' and s->>'deadline' is not null and now()>=(s->>'deadline')::timestamptz then raise exception 'The turn has expired. Refresh the table.'; end if;
 if a<>'timeout' and (s->'players'->actor->>'eliminated')::boolean then raise exception 'You have been eliminated'; end if;
 h:=s->'players'->idx->'hand';
 event:=jsonb_build_object('type',a,'actor',s->'players'->idx->>'id');
 if a='forfeit' then
  -- Returning abandoned cards to the market preserves the deck.
  s:=jsonb_set(s,array['deck'],arena_private.shuffle((s->'deck')||(s->'players'->actor->'hand')));
  s:=jsonb_set(s,array['players',actor::text,'hand'],'[]');
  s:=jsonb_set(s,array['players',actor::text,'eliminated'],'true');
  s:=jsonb_set(s,array['players',actor::text,'total'],to_jsonb((s->'rules'->>'targetScore')::int));
  select count(*) into active_count from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  if active_count=1 then select value->>'id' into win from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  elsif actor=idx then idx:=arena_private.next_player(s,idx); end if;
  event:=jsonb_build_object('type','forfeit','actor',uid);
  s:=s||jsonb_build_object('message','A player left the match.');
 elsif a='play' then
  select value into c from jsonb_array_elements(h) where value->>'id'=v->>'card';
  if c is null or not arena_private.playable(s,c) then raise exception 'That card cannot be played'; end if;
  if c->>'suit'='whot' and (s->'rules'->>'whotCallsSuit')::boolean and coalesce(v->>'suit','') not in ('circle','triangle','cross','square','star') then raise exception 'Choose a symbol'; end if;
  select coalesce(jsonb_agg(value),'[]') into h from jsonb_array_elements(h) where value->>'id'<>c->>'id';
  s:=jsonb_set(s,array['players',idx::text,'hand'],h);
  s:=s||jsonb_build_object('discard',(s->'discard')||jsonb_build_array(c),'calledSuit',case when c->>'suit'='whot' and (s->'rules'->>'whotCallsSuit')::boolean then v->>'suit' else null end,'passes',0);
  n:=(c->>'value')::int;
  if n in (2,5) and (s->'rules'->>case when n=2 then 'pickTwoEnabled' else 'pickThreeEnabled' end)::boolean then
   mode:=s->'rules'->>case when n=2 then 'pickTwoMode' else 'pickThreeMode' end;
   s:=s||jsonb_build_object('penalty',case when mode='block' and (s->>'penalty')::int>0 then 0 else (s->>'penalty')::int+case when n=2 then 2 else 3 end end,'penaltyType',n);
  elsif n=1 and (s->'rules'->>'holdOnEnabled')::boolean then steps:=0;
  elsif n=8 and (s->'rules'->>'suspensionEnabled')::boolean then steps:=2;
  elsif n=14 and (s->'rules'->>'generalMarketEnabled')::boolean then
   for j in 0..jsonb_array_length(s->'players')-1 loop
    if j<>idx and not (s->'players'->j->>'eliminated')::boolean then s:=arena_private.draw(s,j,1); end if;
   end loop; steps:=0;
  end if;
  if jsonb_array_length(h)=0 then win:=s->'players'->idx->>'id'; end if;
  event:=event||jsonb_build_object('card',c);
  s:=s||jsonb_build_object('message',(s->'players'->idx->>'name')||' played '||(c->>'suit')||' '||n||case when jsonb_array_length(h)=1 and (s->'rules'->>'endCalls')::boolean then ' — Last card!' else '' end);
  idx:=arena_private.next_player(s,idx,steps);
 elsif a in ('draw','timeout') then
  before_count:=jsonb_array_length(h);
  n:=greatest(1,(s->>'penalty')::int);
  s:=arena_private.draw(s,idx,n);
  if n=1 and (s->>'penalty')::int=0 and s->'rules'->>'drawMode'='until-playable' then
   for j in 1..54 loop
    exit when exists(select 1 from jsonb_array_elements(s->'players'->idx->'hand') where arena_private.playable(s,value));
    exit when jsonb_array_length(s->'deck')=0 and (jsonb_array_length(s->'discard')<=1 or coalesce(s->'rules'->>'emptyMarketMode','score')<>'recycle');
    s:=arena_private.draw(s,idx,1);
   end loop;
  end if;
  drawn:=jsonb_array_length(s->'players'->idx->'hand')-before_count;
  s:=s||jsonb_build_object('penalty',0,'penaltyType',0,'passes',case when drawn=0 then (s->>'passes')::int+1 else 0 end,'message',(s->'players'->idx->>'name')||case when a='timeout' then ' ran out of time and drew ' else ' drew ' end||drawn||' card(s).');
  event:=event||jsonb_build_object('count',drawn);
  -- Until-playable keeps the turn only when a valid card was actually found.
  if a='timeout' or n>1 or s->'rules'->>'drawMode'='one' or drawn=0 then idx:=arena_private.next_player(s,idx); end if;
  select count(*) into active_count from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  if (s->>'passes')::int>=active_count then
   select p.value->>'id' into win from jsonb_array_elements(s->'players') p where not (p.value->>'eliminated')::boolean
   order by (select coalesce(sum((c.value->>'score')::int),0) from jsonb_array_elements(p.value->'hand') c),p.value->>'id' limit 1;
   s:=s||'{"message":"Market blocked. Highest hand score loses; tied scores use seat identity order."}'::jsonb;
  end if;
 else raise exception 'Unknown move'; end if;
 s:=s||jsonb_build_object('turn',idx,'event',event,'deadline',case when s->'rules'->>'turnTimer'='off' then null else now()+((s->'rules'->>'turnTimer')::int*interval '1 second') end);
 if win is not null then s:=arena_private.finish(gid,s||jsonb_build_object('winner',win)); end if;
 update arena_private.games set state=s,version=version+1,updated_at=now() where id=gid;
 if s->>'status'='finished' and g.room_id is not null then update public.rooms set status='finished' where id=g.room_id; end if;
 if s->>'status'='finished' and g.tournament_id is not null then perform arena_private.advance(g.tournament_id); end if;
 perform arena_private.ping(g.room_id,g.tournament_id);
end $$;

create or replace function arena_private.view_game(gid uuid,uid uuid) returns jsonb language plpgsql as $$
declare g arena_private.games; s jsonb; ps jsonb; me jsonb;
begin
 select * into g from arena_private.games where id=gid; s:=g.state;
 select value into me from jsonb_array_elements(s->'players') where value->>'id'=uid::text;
 if me is null then raise exception 'You are not in this match'; end if;
 select jsonb_agg((value-'hand')||jsonb_build_object('count',jsonb_array_length(value->'hand'))) into ps from jsonb_array_elements(s->'players');
 return (s-'deck'-'players'-'discard')||jsonb_build_object('id',g.id,'version',g.version,'players',ps,'hand',me->'hand','me',uid,
 'top',s->'discard'->(jsonb_array_length(s->'discard')-1),'marketCount',jsonb_array_length(s->'deck'),'tournamentId',g.tournament_id,'roomId',g.room_id,'serverTime',now());
end $$;

create or replace function public.arena(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,arena_private,pg_temp as $$
declare uid uuid:=auth.uid(); r public.rooms; t public.tournaments; gid uuid; g arena_private.games; ps jsonb; out jsonb; cfg jsonb; n int; seat_no int; code text; nm text; req uuid; prior jsonb; lock_key text; i int; roster jsonb; active_matches jsonb; completed_matches jsonb;
begin
 if action='health' then return '{"schemaVersion":1}'::jsonb; end if;
 if uid is null then raise exception 'Sign in to continue'; end if;
 if jsonb_typeof(input)<>'object' or octet_length(input::text)>16000 then raise exception 'Invalid request'; end if;
 -- Shared scope lock prevents joins, starts and tournament advancement racing.
 if input ? 'game' then
  select * into g from arena_private.games where id=(input->>'game')::uuid;
  lock_key:=coalesce(g.tournament_id,g.room_id,g.id)::text;
 elsif input ? 'tournament' then lock_key:=input->>'tournament';
 elsif input ? 'code' then select * into r from public.rooms where rooms.code=upper(input->>'code'); lock_key:=r.id::text;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(lock_key,uid::text),0));
 if action not in ('room','game','tournament','history','heartbeat') then
  req:=(input->>'requestId')::uuid;
  if req is null then raise exception 'A request ID is required'; end if;
  select result into prior from arena_private.requests where user_id=uid and request_id=req;
  if found then return prior; end if;
 end if;
 select coalesce(nullif(display_name,''),'Player') into nm from public.profiles where id=uid;
 nm:=coalesce(nm,'Player');
 if action='createRoom' then
  cfg:=arena_private.rules(input->'rules'); n:=(input->>'maxPlayers')::int;
  if n is null or n not between 2 and 5 or length(trim(input->>'name')) not between 1 and 80 then raise exception 'Enter a name and 2–5 seats'; end if;
  if (select count(*) from public.rooms where host_id=uid and status='waiting')>=10 then raise exception 'Close an existing waiting room first'; end if;
  loop
   code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
   begin
    insert into public.rooms(code,name,host_id,max_players,rule_config,mode) values(code,trim(input->>'name'),uid,n,cfg,cfg->>'gameType') returning * into r; exit;
   exception when unique_violation then null; end;
  end loop;
  insert into public.room_players(room_id,user_id,display_name,seat,ready) values(r.id,uid,nm,1,true);
  out:=jsonb_build_object('code',r.code);
 elsif action in ('room','joinRoom','ready','leaveRoom','startRoom','settings','rematch','heartbeat') then
  select * into r from public.rooms where rooms.code=upper(input->>'code') for update;
  if not found then raise exception 'Room not found'; end if;
  if action='joinRoom' then
   if exists(select 1 from public.room_players where room_id=r.id and user_id=uid) then null;
   else
    if r.status<>'waiting' then raise exception 'This table has started'; end if;
    select x into seat_no from generate_series(1,r.max_players) x where not exists(select 1 from public.room_players where room_id=r.id and seat=x) limit 1;
    if seat_no is null then raise exception 'This table is full'; end if;
    insert into public.room_players(room_id,user_id,display_name,seat) values(r.id,uid,left(coalesce(nullif(trim(input->>'name'),''),nm),40),seat_no);
   end if;
  end if;
  if not exists(select 1 from public.room_players where room_id=r.id and user_id=uid) then raise exception 'Join this table using its code first'; end if;
  insert into arena_private.visits(room_id,user_id) values(r.id,uid) on conflict(room_id,user_id) do update set seen_at=now();
  if action='ready' then
   if r.status<>'waiting' then raise exception 'This table has started'; end if;
   update public.room_players set ready=(input->>'ready')::boolean where room_id=r.id and user_id=uid;
  elsif action='settings' then
   if r.host_id<>uid or r.status<>'waiting' then raise exception 'Only the host can change waiting room rules'; end if;
   update public.rooms set rule_config=arena_private.rules(input->'rules') where id=r.id;
   update public.room_players set ready=false where room_id=r.id;
  elsif action in ('startRoom','rematch') then
   if r.host_id<>uid then raise exception 'Only the host can start'; end if;
   if action='rematch' then
    if r.status<>'finished' then raise exception 'Finish the current match first'; end if;
    update public.rooms set status='waiting',active_match_id=null where id=r.id;
    update public.room_players set ready=false where room_id=r.id;
   else
    if r.status<>'waiting' then raise exception 'This table has already started'; end if;
    if (select count(*) from public.room_players where room_id=r.id)<2 or exists(select 1 from public.room_players where room_id=r.id and not ready) then raise exception 'Every player must be ready'; end if;
    select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) order by seat) into ps from public.room_players where room_id=r.id;
    gid:=arena_private.new_game(r.id,null,ps,arena_private.rules(r.rule_config));
    update public.rooms set status='running' where id=r.id;
   end if;
  elsif action='leaveRoom' then
   if r.status='running' then raise exception 'Forfeit the match before leaving the table'; end if;
   delete from public.room_players where room_id=r.id and user_id=uid;
   if r.host_id=uid then
    if exists(select 1 from public.room_players where room_id=r.id) then update public.rooms set host_id=(select user_id from public.room_players where room_id=r.id order by seat limit 1) where id=r.id;
    else update public.rooms set status='cancelled' where id=r.id; end if;
   end if;
   out:='{"left":true}';
  end if;
  if out is null then
   select * into r from public.rooms where id=r.id;
   select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.display_name,'seat',p.seat,'ready',p.ready,'connected',coalesce(v.seen_at>now()-interval '35 seconds',false)) order by p.seat) into ps from public.room_players p left join arena_private.visits v on v.room_id=p.room_id and v.user_id=p.user_id where p.room_id=r.id;
   select id into gid from arena_private.games where room_id=r.id order by updated_at desc limit 1;
   out:=jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'host',r.host_id,'me',uid,'maxPlayers',r.max_players,'rules',r.rule_config,'status',r.status,'players',coalesce(ps,'[]'),'game',gid);
  end if;
 elsif action in ('game','play','draw','timeout','forfeit') then
  gid:=(input->>'game')::uuid;
  if action<>'game' then perform arena_private.move(gid,uid,action,input); end if;
  out:=arena_private.view_game(gid,uid);
 elsif action='createTournament' then
  cfg:=arena_private.rules(input->'rules'); n:=(input->>'maxPlayers')::int;
  if n is null or n not between 4 and 128 or length(trim(input->>'name')) not between 1 and 80 or (input->>'startsAt')::timestamptz<now() then raise exception 'Choose a future time, name and 4–128 seats'; end if;
  if (select count(*) from public.tournaments where host_id=uid and status='registration')>=5 then raise exception 'Start or cancel an existing event first'; end if;
  insert into public.tournaments(name,host_id,starts_at,max_players,rule_config) values(trim(input->>'name'),uid,(input->>'startsAt')::timestamptz,n,cfg) returning * into t;
  insert into public.tournament_players(tournament_id,user_id,display_name,seed) values(t.id,uid,nm,1);
  out:=jsonb_build_object('id',t.id);
 elsif action in ('tournament','joinTournament','withdrawTournament','startTournament','cancelTournament') then
  select * into t from public.tournaments where id=(input->>'tournament')::uuid for update;
  if not found then raise exception 'Tournament not found'; end if;
  if action='joinTournament' then
   if t.status<>'registration' then raise exception 'Registration is closed'; end if;
   if not exists(select 1 from public.tournament_players where tournament_id=t.id and user_id=uid) then
    select count(*) into n from public.tournament_players where tournament_id=t.id;
    if n>=t.max_players then raise exception 'The tournament is full'; end if;
    insert into public.tournament_players(tournament_id,user_id,display_name,seed) values(t.id,uid,left(coalesce(nullif(trim(input->>'name'),''),nm),40),n+1);
   end if;
  elsif action='withdrawTournament' then
   if t.status<>'registration' then raise exception 'Registration is closed. Forfeit your current match to withdraw.'; end if;
   delete from public.tournament_players where tournament_id=t.id and user_id=uid;
  elsif action='cancelTournament' then
   if t.host_id<>uid or t.status<>'registration' then raise exception 'Only the host can cancel before starting'; end if;
   update public.tournaments set status='cancelled' where id=t.id;
  elsif action='startTournament' then
   if t.host_id<>uid or t.status<>'registration' then raise exception 'Only the host can start an open tournament'; end if;
   select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) order by gen_random_uuid()) into ps from public.tournament_players where tournament_id=t.id;
   if coalesce(jsonb_array_length(ps),0)<2 then raise exception 'At least two players are required'; end if;
   update public.tournaments set status='running' where id=t.id;
   update public.tournament_players set status='active' where tournament_id=t.id;
   i:=0;
   while i<jsonb_array_length(ps) loop
    roster:=jsonb_build_array(ps->i);
    if i+1<jsonb_array_length(ps) then roster:=roster||jsonb_build_array(ps->(i+1)); end if;
    gid:=arena_private.new_game(null,t.id,roster,t.rule_config,1);
    if jsonb_array_length(roster)=1 then update arena_private.games set state=state||jsonb_build_object('status','finished','winner',roster->0->>'id','message','Bye — advanced to next round') where id=gid; end if;
    i:=i+2;
   end loop;
  end if;
  select * into t from public.tournaments where id=t.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',display_name,'status',status) order by seed),'[]') into ps from public.tournament_players where tournament_id=t.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',gg.id,'round',gg.round_no,'status',gg.state->>'status','winner',gg.state->>'winner','players',(select jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name')) from jsonb_array_elements(gg.state->'players'))) order by gg.round_no,gg.id),'[]') into roster from arena_private.games gg where tournament_id=t.id;
  out:=jsonb_build_object('id',t.id,'name',t.name,'host',t.host_id,'me',uid,'startsAt',t.starts_at,'maxPlayers',t.max_players,'rules',t.rule_config,'status',t.status,'players',ps,'matches',roster);
 elsif action='history' then
  select coalesce(jsonb_agg(jsonb_build_object('game_id',g.id,'room_id',g.room_id,'room_code',r.code,'room_name',r.name,'tournament_id',g.tournament_id,'round',g.round_no,'status',g.state->>'status','turn_id',turn_player.value->>'id','turn_name',turn_player.value->>'name','my_turn',turn_player.value->>'id'=uid::text,'updated_at',g.updated_at,'message',coalesce(g.state->>'message',''),'player_count',jsonb_array_length(g.state->'players')) order by g.updated_at desc),'[]'::jsonb) into active_matches
  from arena_private.games g
  left join public.rooms r on r.id=g.room_id
  left join lateral (select p.value from jsonb_array_elements(g.state->'players') with ordinality as p(value,turn_index) where p.turn_index=(g.state->>'turn')::int+1) turn_player on true
  where g.state->>'status'='running' and exists(select 1 from jsonb_array_elements(g.state->'players') p where p->>'id'=uid::text);
  select coalesce(jsonb_agg(jsonb_build_object('game_id',rr.game_id,'score',rr.score,'won',rr.won,'created_at',rr.created_at,'tournament_id',gg.tournament_id,'room_id',gg.room_id,'room_code',r.code,'room_name',r.name,'round',gg.round_no,'winner_id',gg.state->>'winner','winner_name',winner_player.name) order by rr.created_at desc),'[]'::jsonb) into completed_matches
  from arena_private.results rr
  join arena_private.games gg on gg.id=rr.game_id
  left join public.rooms r on r.id=gg.room_id
  left join lateral (select p.value->>'name' as name from jsonb_array_elements(gg.state->'players') p(value) where p.value->>'id'=gg.state->>'winner' limit 1) winner_player on true
  where rr.user_id=uid;
  ps:=completed_matches;
  select coalesce(jsonb_agg(x),'[]') into roster from (select p.display_name,count(*) games,count(*) filter(where rr.won) wins from arena_private.results rr join public.profiles p on p.id=rr.user_id group by rr.user_id,p.display_name order by wins desc,games desc limit 25) x;
  out:=jsonb_build_object('active',active_matches,'completed',completed_matches,'history',ps,'leaderboard',roster);
 else raise exception 'Unknown action'; end if;
 if r.id is not null and action not in ('room','heartbeat') then perform arena_private.ping(r.id,null); end if;
 if t.id is not null and action<>'tournament' then perform arena_private.ping(null,t.id); end if;
 if req is not null then insert into arena_private.requests(user_id,request_id,result) values(uid,req,out); end if;
 return out;
end $$;
-- Definer helper functions are never directly callable from the API.
revoke all on all functions in schema arena_private from public,anon,authenticated;
revoke all on function public.arena(text,jsonb) from public;
grant execute on function public.arena(text,jsonb) to anon,authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='arena_updates') then
  alter publication supabase_realtime add table public.arena_updates;
 end if;
end $$;
commit;
-- Whot Arena: custom room sizing and Tender elimination mode.
-- Apply after 20260911_arena.sql, or use the updated setup.sql.
begin;
alter table public.rooms drop constraint if exists rooms_mode_check;
alter table public.rooms add constraint rooms_mode_check check (mode in ('classic','knockout','tender','tournament'));
alter table public.rooms drop constraint if exists rooms_max_players_check;
alter table public.rooms add constraint rooms_max_players_check check (max_players between 2 and 8);
alter table public.room_players drop constraint if exists room_players_seat_check;
alter table public.room_players add constraint room_players_seat_check check (seat between 1 and 8);

create or replace function arena_private.rules(v jsonb) returns jsonb language plpgsql as $$
declare d jsonb := '{"gameType":"classic","initialHand":6,"drawMode":"one","emptyMarketMode":"score","turnTimer":"10","targetScore":100,"clockwise":true,"endCalls":true,"starDouble":true,"whotEnabled":true,"whotCallsSuit":true,"holdOnEnabled":true,"pickTwoEnabled":true,"pickTwoMode":"stack","pickThreeEnabled":true,"pickThreeMode":"stack","suspensionEnabled":true,"generalMarketEnabled":true}'; k text;
begin
 if v is null then return d; end if;
 if jsonb_typeof(v)<>'object' then raise exception 'Invalid rules'; end if;
 for k in select jsonb_object_keys(d) loop
  if v ? k then
   if jsonb_typeof(v->k)<>jsonb_typeof(d->k) then raise exception 'Invalid rule: %',k; end if;
   d:=jsonb_set(d,array[k],v->k);
  end if;
 end loop;
 if d->>'gameType' not in ('classic','knockout','tender') or d->>'drawMode' not in ('one','until-playable') or d->>'emptyMarketMode' not in ('score','recycle')
 or d->>'turnTimer' not in ('off','10','15','30') or d->>'pickTwoMode' not in ('stack','block','none')
 or d->>'pickThreeMode' not in ('stack','block','none') or (d->>'initialHand')::int not between 3 and 12
 or (d->>'targetScore')::int not in (50,100,200) then raise exception 'Invalid rules'; end if;
 return d;
end $$;

create or replace function arena_private.validate_room_config(rules jsonb,players int) returns void language plpgsql as $$
declare available int:=case when (rules->>'whotEnabled')::boolean then 54 else 49 end;
begin
 if players is null or players not between 2 and 8 then raise exception 'Choose between 2 and 8 players'; end if;
 if (players*(rules->>'initialHand')::int)+1>available then raise exception 'That hand size is too large for this many players'; end if;
end $$;

create or replace function arena_private.new_game(r uuid,t uuid,roster jsonb,rules jsonb,round_no int default 1) returns uuid language plpgsql as $$
declare gid uuid;
begin
 insert into arena_private.games(room_id,tournament_id,round_no,state) values(r,t,round_no,arena_private.deal(roster,rules,round_no)) returning id into gid;
 return gid;
end $$;

create or replace function arena_private.finish(gid uuid,s jsonb) returns jsonb language plpgsql as $$
declare p jsonb; i int:=0; score int; alive int; winner text:=s->>'winner'; roster jsonb; t uuid; eliminated_id text; eliminated_score int; fresh jsonb; eliminated jsonb; tally jsonb;
begin
 for p in select value from jsonb_array_elements(s->'players') loop
  select coalesce(sum((value->>'score')::int),0) into score from jsonb_array_elements(p->'hand');
  s:=jsonb_set(s,array['players',i::text,'roundScore'],to_jsonb(score));
  s:=jsonb_set(s,array['players',i::text,'total'],to_jsonb(coalesce((p->>'total')::int,0)+score));
  i:=i+1;
 end loop;
 if s->'rules'->>'gameType'='tender' and winner is null then
  select value->>'id',(value->>'roundScore')::int into eliminated_id,eliminated_score
  from jsonb_array_elements(s->'players')
  where not coalesce((value->>'eliminated')::boolean,false)
  order by (value->>'roundScore')::int,value->>'id' limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name','score',(value->>'roundScore')::int,'eliminated',value->>'id'=eliminated_id) order by (value->>'roundScore')::int,value->>'id'),'[]'::jsonb)
  into tally from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
  if eliminated_id is null then raise exception 'Tender table has no active players'; end if;
  i:=0;
  for p in select value from jsonb_array_elements(s->'players') loop
   if p->>'id'=eliminated_id then s:=jsonb_set(s,array['players',i::text,'eliminated'],'true'); end if;
   i:=i+1;
  end loop;
  select count(*) into alive from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
  if alive>1 then
   select jsonb_agg(value-'hand'-'roundScore') into roster from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
   fresh:=arena_private.deal(roster,s->'rules',(s->>'round')::int+1);
   select coalesce(jsonb_agg(value||jsonb_build_object('hand','[]'::jsonb,'eliminated',true)),'[]'::jsonb) into eliminated from jsonb_array_elements(s->'players') where coalesce((value->>'eliminated')::boolean,false);
   return fresh||jsonb_build_object('players',(fresh->'players')||eliminated,'tenderTally',tally,'message',(select value->>'name' from jsonb_array_elements(s->'players') where value->>'id'=eliminated_id limit 1)||' was eliminated with '||eliminated_score||' points. Next tender round.','event',jsonb_build_object('type','tender-elimination','actor',eliminated_id));
  end if;
  select value->>'id' into winner from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false) limit 1;
 elsif s->'rules'->>'gameType'='knockout' then
  i:=0;
  for p in select value from jsonb_array_elements(s->'players') loop
   if (p->>'total')::int>=(s->'rules'->>'targetScore')::int then s:=jsonb_set(s,array['players',i::text,'eliminated'],'true'); end if;
   i:=i+1;
  end loop;
  select count(*) into alive from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  if alive>1 then
   select jsonb_agg(value-'hand'-'roundScore') into roster from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
   declare fresh_round jsonb; eliminated_round jsonb; begin
    fresh_round:=arena_private.deal(roster,s->'rules',(s->>'round')::int+1);
    select coalesce(jsonb_agg(value||'{"hand":[]}'::jsonb),'[]') into eliminated_round from jsonb_array_elements(s->'players') where (value->>'eliminated')::boolean;
    return fresh_round||jsonb_build_object('players',(fresh_round->'players')||eliminated_round,'message','Round complete. Scores added; the next round is dealt.');
   end;
  end if;
  select value->>'id' into winner from jsonb_array_elements(s->'players') order by (value->>'total')::int,value->>'id' limit 1;
 end if;
 if tally is not null then s:=s||jsonb_build_object('tenderTally',tally); end if;
 s:=s||jsonb_build_object('status','finished','winner',winner,'deadline',null);
 for p in select value from jsonb_array_elements(s->'players') loop
  insert into arena_private.results(game_id,user_id,score,won) values(gid,(p->>'id')::uuid,(p->>'total')::int,p->>'id'=winner) on conflict do nothing;
 end loop;
 select tournament_id into t from arena_private.games where id=gid;
 if t is not null then update public.tournament_players set status='eliminated' where tournament_id=t and user_id<>winner::uuid and user_id in(select (value->>'id')::uuid from jsonb_array_elements(s->'players')); end if;
 return s;
end $$;

create or replace function arena_private.move(gid uuid,uid uuid,a text,v jsonb) returns void language plpgsql as $$
declare g arena_private.games; s jsonb; idx int; actor int; c jsonb; h jsonb; n int; steps int:=1; mode text; before_count int; drawn int:=0; j int; active_count int; win text; event jsonb; tender_end boolean:=false;
begin
 select * into g from arena_private.games where id=gid for update;
 if not found then raise exception 'Game not found'; end if;
 s:=g.state; idx:=(s->>'turn')::int;
 select ordinality::int-1 into actor from jsonb_array_elements(s->'players') with ordinality where value->>'id'=uid::text;
 if actor is null then raise exception 'You are not at this match'; end if;
 if s->>'status'<>'running' then raise exception 'This match has ended'; end if;
 if a='timeout' then
  if s->>'deadline' is null or now()<(s->>'deadline')::timestamptz then raise exception 'The turn has not expired'; end if;
 elsif (v->>'version')::int is distinct from g.version then raise exception 'Table changed. Try your move again.';
 elsif actor<>idx and a<>'forfeit' then raise exception 'It is not your turn';
 elsif a<>'forfeit' and s->>'deadline' is not null and now()>=(s->>'deadline')::timestamptz then raise exception 'The turn has expired. Refresh the table.'; end if;
 if a<>'timeout' and (s->'players'->actor->>'eliminated')::boolean then raise exception 'You have been eliminated'; end if;
 h:=s->'players'->idx->'hand';
 event:=jsonb_build_object('type',a,'actor',s->'players'->idx->>'id');
 if a='forfeit' then
  s:=jsonb_set(s,array['deck'],arena_private.shuffle((s->'deck')||(s->'players'->actor->'hand')));
  s:=jsonb_set(s,array['players',actor::text,'hand'],'[]');
  s:=jsonb_set(s,array['players',actor::text,'eliminated'],'true');
  s:=jsonb_set(s,array['players',actor::text,'total'],to_jsonb((s->'rules'->>'targetScore')::int));
  select count(*) into active_count from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  if active_count=1 then select value->>'id' into win from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  elsif actor=idx then idx:=arena_private.next_player(s,idx); end if;
  event:=jsonb_build_object('type','forfeit','actor',uid);
  s:=s||jsonb_build_object('message','A player left the match.');
 elsif a='play' then
  select value into c from jsonb_array_elements(h) where value->>'id'=v->>'card';
  if c is null or not arena_private.playable(s,c) then raise exception 'That card cannot be played'; end if;
  if c->>'suit'='whot' and (s->'rules'->>'whotCallsSuit')::boolean and coalesce(v->>'suit','') not in ('circle','triangle','cross','square','star') then raise exception 'Choose a symbol'; end if;
  select coalesce(jsonb_agg(value),'[]') into h from jsonb_array_elements(h) where value->>'id'<>c->>'id';
  s:=jsonb_set(s,array['players',idx::text,'hand'],h);
  s:=s||jsonb_build_object('discard',(s->'discard')||jsonb_build_array(c),'calledSuit',case when c->>'suit'='whot' and (s->'rules'->>'whotCallsSuit')::boolean then v->>'suit' else null end,'passes',0);
  n:=(c->>'value')::int;
  if n in (2,5) and (s->'rules'->>case when n=2 then 'pickTwoEnabled' else 'pickThreeEnabled' end)::boolean then
   mode:=s->'rules'->>case when n=2 then 'pickTwoMode' else 'pickThreeMode' end;
   s:=s||jsonb_build_object('penalty',case when mode='block' and (s->>'penalty')::int>0 then 0 else (s->>'penalty')::int+case when n=2 then 2 else 3 end end,'penaltyType',n);
  elsif n=1 and (s->'rules'->>'holdOnEnabled')::boolean then steps:=0;
  elsif n=8 and (s->'rules'->>'suspensionEnabled')::boolean then steps:=2;
  elsif n=14 and (s->'rules'->>'generalMarketEnabled')::boolean then
   for j in 0..jsonb_array_length(s->'players')-1 loop
    if j<>idx and not (s->'players'->j->>'eliminated')::boolean then s:=arena_private.draw(s,j,1); end if;
   end loop; steps:=0;
  end if;
  if jsonb_array_length(h)=0 then win:=s->'players'->idx->>'id'; end if;
  event:=event||jsonb_build_object('card',c);
  s:=s||jsonb_build_object('message',(s->'players'->idx->>'name')||' played '||(c->>'suit')||' '||n||case when jsonb_array_length(h)=1 and (s->'rules'->>'endCalls')::boolean then ' — Last card!' else '' end);
  idx:=arena_private.next_player(s,idx,steps);
 elsif a in ('draw','timeout') then
  before_count:=jsonb_array_length(h);
  n:=greatest(1,(s->>'penalty')::int);
  s:=arena_private.draw(s,idx,n);
  if n=1 and (s->>'penalty')::int=0 and s->'rules'->>'drawMode'='until-playable' then
   for j in 1..54 loop
    exit when exists(select 1 from jsonb_array_elements(s->'players'->idx->'hand') where arena_private.playable(s,value));
    exit when jsonb_array_length(s->'deck')=0 and (jsonb_array_length(s->'discard')<=1 or coalesce(s->'rules'->>'emptyMarketMode','score')<>'recycle');
    s:=arena_private.draw(s,idx,1);
   end loop;
  end if;
  drawn:=jsonb_array_length(s->'players'->idx->'hand')-before_count;
  s:=s||jsonb_build_object('penalty',0,'penaltyType',0,'passes',case when drawn=0 then (s->>'passes')::int+1 else 0 end,'message',(s->'players'->idx->>'name')||case when a='timeout' then ' ran out of time and drew ' else ' drew ' end||drawn||' card(s).');
  event:=event||jsonb_build_object('count',drawn);
  if a='timeout' or n>1 or s->'rules'->>'drawMode'='one' or drawn=0 then idx:=arena_private.next_player(s,idx); end if;
  select count(*) into active_count from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  if (s->>'passes')::int>=active_count then
   if s->'rules'->>'gameType'='tender' then
    tender_end:=true;
    s:=s||jsonb_build_object('message','The market is empty. Counting every active hand…');
   else
    select p.value->>'id' into win from jsonb_array_elements(s->'players') p where not (p.value->>'eliminated')::boolean
    order by (select coalesce(sum((c.value->>'score')::int),0) from jsonb_array_elements(p.value->'hand') c),p.value->>'id' limit 1;
    s:=s||'{"message":"Market blocked. Highest hand score loses; tied scores use seat identity order."}'::jsonb;
   end if;
  end if;
 else raise exception 'Unknown move'; end if;
 s:=s||jsonb_build_object('turn',idx,'event',event,'deadline',case when s->'rules'->>'turnTimer'='off' then null else now()+((s->'rules'->>'turnTimer')::int*interval '1 second') end);
 if tender_end then s:=arena_private.finish(gid,s); elsif win is not null then s:=arena_private.finish(gid,s||jsonb_build_object('winner',win)); end if;
 update arena_private.games set state=s,version=version+1,updated_at=now() where id=gid;
 if s->>'status'='finished' and g.room_id is not null then update public.rooms set status='finished' where id=g.room_id; end if;
 if s->>'status'='finished' and g.tournament_id is not null then perform arena_private.advance(g.tournament_id); end if;
 perform arena_private.ping(g.room_id,g.tournament_id);
end $$;

create or replace function public.arena(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,arena_private,pg_temp as $$
declare uid uuid:=auth.uid(); r public.rooms; t public.tournaments; gid uuid; g arena_private.games; ps jsonb; out jsonb; cfg jsonb; n int; seat_no int; code text; nm text; req uuid; prior jsonb; lock_key text; i int; roster jsonb; active_matches jsonb; completed_matches jsonb;
begin
 if action='health' then return '{"schemaVersion":2}'::jsonb; end if;
 if uid is null then raise exception 'Sign in to continue'; end if;
 if jsonb_typeof(input)<>'object' or octet_length(input::text)>16000 then raise exception 'Invalid request'; end if;
 -- Shared scope lock prevents joins, starts and tournament advancement racing.
 if input ? 'game' then
  select * into g from arena_private.games where id=(input->>'game')::uuid;
  lock_key:=coalesce(g.tournament_id,g.room_id,g.id)::text;
 elsif input ? 'tournament' then lock_key:=input->>'tournament';
 elsif input ? 'code' then select * into r from public.rooms where rooms.code=upper(input->>'code'); lock_key:=r.id::text;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(lock_key,uid::text),0));
 if action not in ('room','game','tournament','history','heartbeat') then
  req:=(input->>'requestId')::uuid;
  if req is null then raise exception 'A request ID is required'; end if;
  select result into prior from arena_private.requests where user_id=uid and request_id=req;
  if found then return prior; end if;
 end if;
 select coalesce(nullif(display_name,''),'Player') into nm from public.profiles where id=uid;
 nm:=coalesce(nm,'Player');
 if action='createRoom' then
  cfg:=arena_private.rules(input->'rules'); n:=(input->>'maxPlayers')::int;
  if n is null or n not between 2 and 8 or length(trim(input->>'name')) not between 1 and 80 then raise exception 'Enter a name and 2–8 seats'; end if;
  perform arena_private.validate_room_config(cfg,n);
  if (select count(*) from public.rooms where host_id=uid and status='waiting')>=10 then raise exception 'Close an existing waiting room first'; end if;
  loop
   code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
   begin
    insert into public.rooms(code,name,host_id,max_players,rule_config,mode) values(code,trim(input->>'name'),uid,n,cfg,cfg->>'gameType') returning * into r; exit;
   exception when unique_violation then null; end;
  end loop;
  insert into public.room_players(room_id,user_id,display_name,seat,ready) values(r.id,uid,nm,1,true);
  out:=jsonb_build_object('code',r.code);
 elsif action in ('room','joinRoom','ready','leaveRoom','startRoom','settings','rematch','heartbeat') then
  select * into r from public.rooms where rooms.code=upper(input->>'code') for update;
  if not found then raise exception 'Room not found'; end if;
  if action='joinRoom' then
   if exists(select 1 from public.room_players where room_id=r.id and user_id=uid) then null;
   else
    if r.status<>'waiting' then raise exception 'This table has started'; end if;
    select x into seat_no from generate_series(1,r.max_players) x where not exists(select 1 from public.room_players where room_id=r.id and seat=x) limit 1;
    if seat_no is null then raise exception 'This table is full'; end if;
    insert into public.room_players(room_id,user_id,display_name,seat) values(r.id,uid,nm,seat_no);
   end if;
  end if;
  if not exists(select 1 from public.room_players where room_id=r.id and user_id=uid) then raise exception 'Join this table using its code first'; end if;
  insert into arena_private.visits(room_id,user_id) values(r.id,uid) on conflict(room_id,user_id) do update set seen_at=now();
  if action='ready' then
   if r.status<>'waiting' then raise exception 'This table has started'; end if;
   update public.room_players set ready=(input->>'ready')::boolean where room_id=r.id and user_id=uid;
  elsif action='settings' then
   if r.host_id<>uid or r.status<>'waiting' then raise exception 'Only the host can change waiting room rules'; end if;
   cfg:=arena_private.rules(input->'rules');
   perform arena_private.validate_room_config(cfg,r.max_players);
   update public.rooms set rule_config=cfg,mode=cfg->>'gameType' where id=r.id;
   update public.room_players set ready=false where room_id=r.id;
  elsif action in ('startRoom','rematch') then
   if r.host_id<>uid then raise exception 'Only the host can start'; end if;
   if action='rematch' then
    if r.status<>'finished' then raise exception 'Finish the current match first'; end if;
    update public.rooms set status='waiting',active_match_id=null where id=r.id;
    update public.room_players set ready=false where room_id=r.id;
   else
    if r.status<>'waiting' then raise exception 'This table has already started'; end if;
    if (select count(*) from public.room_players where room_id=r.id)<2 or exists(select 1 from public.room_players where room_id=r.id and not ready) then raise exception 'Every player must be ready'; end if;
    select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) order by seat) into ps from public.room_players where room_id=r.id;
    cfg:=arena_private.rules(r.rule_config);
    perform arena_private.validate_room_config(cfg,r.max_players);
    gid:=arena_private.new_game(r.id,null,ps,cfg);
    update public.rooms set status='running' where id=r.id;
   end if;
  elsif action='leaveRoom' then
   if r.status='running' then raise exception 'Forfeit the match before leaving the table'; end if;
   delete from public.room_players where room_id=r.id and user_id=uid;
   if r.host_id=uid then
    if exists(select 1 from public.room_players where room_id=r.id) then update public.rooms set host_id=(select user_id from public.room_players where room_id=r.id order by seat limit 1) where id=r.id;
    else update public.rooms set status='cancelled' where id=r.id; end if;
   end if;
   out:='{"left":true}';
  end if;
  if out is null then
   select * into r from public.rooms where id=r.id;
   select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.display_name,'seat',p.seat,'ready',p.ready,'connected',coalesce(v.seen_at>now()-interval '35 seconds',false)) order by p.seat) into ps from public.room_players p left join arena_private.visits v on v.room_id=p.room_id and v.user_id=p.user_id where p.room_id=r.id;
   select id into gid from arena_private.games where room_id=r.id order by updated_at desc limit 1;
   out:=jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'host',r.host_id,'me',uid,'maxPlayers',r.max_players,'rules',r.rule_config,'status',r.status,'players',coalesce(ps,'[]'),'game',gid);
  end if;
 elsif action in ('game','play','draw','timeout','forfeit') then
  gid:=(input->>'game')::uuid;
  if action<>'game' then perform arena_private.move(gid,uid,action,input); end if;
  out:=arena_private.view_game(gid,uid);
 elsif action='createTournament' then
  cfg:=arena_private.rules(input->'rules'); n:=(input->>'maxPlayers')::int;
  if n is null or n not between 4 and 128 or length(trim(input->>'name')) not between 1 and 80 or (input->>'startsAt')::timestamptz<now() then raise exception 'Choose a future time, name and 4–128 seats'; end if;
  if (select count(*) from public.tournaments where host_id=uid and status='registration')>=5 then raise exception 'Start or cancel an existing event first'; end if;
  insert into public.tournaments(name,host_id,starts_at,max_players,rule_config) values(trim(input->>'name'),uid,(input->>'startsAt')::timestamptz,n,cfg) returning * into t;
  insert into public.tournament_players(tournament_id,user_id,display_name,seed) values(t.id,uid,nm,1);
  out:=jsonb_build_object('id',t.id);
 elsif action in ('tournament','joinTournament','withdrawTournament','startTournament','cancelTournament') then
  select * into t from public.tournaments where id=(input->>'tournament')::uuid for update;
  if not found then raise exception 'Tournament not found'; end if;
  if action='joinTournament' then
   if t.status<>'registration' then raise exception 'Registration is closed'; end if;
   if not exists(select 1 from public.tournament_players where tournament_id=t.id and user_id=uid) then
    select count(*) into n from public.tournament_players where tournament_id=t.id;
    if n>=t.max_players then raise exception 'The tournament is full'; end if;
    insert into public.tournament_players(tournament_id,user_id,display_name,seed) values(t.id,uid,left(coalesce(nullif(trim(input->>'name'),''),nm),40),n+1);
   end if;
  elsif action='withdrawTournament' then
   if t.status<>'registration' then raise exception 'Registration is closed. Forfeit your current match to withdraw.'; end if;
   delete from public.tournament_players where tournament_id=t.id and user_id=uid;
  elsif action='cancelTournament' then
   if t.host_id<>uid or t.status<>'registration' then raise exception 'Only the host can cancel before starting'; end if;
   update public.tournaments set status='cancelled' where id=t.id;
  elsif action='startTournament' then
   if t.host_id<>uid or t.status<>'registration' then raise exception 'Only the host can start an open tournament'; end if;
   select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) order by gen_random_uuid()) into ps from public.tournament_players where tournament_id=t.id;
   if coalesce(jsonb_array_length(ps),0)<2 then raise exception 'At least two players are required'; end if;
   update public.tournaments set status='running' where id=t.id;
   update public.tournament_players set status='active' where tournament_id=t.id;
   i:=0;
   while i<jsonb_array_length(ps) loop
    roster:=jsonb_build_array(ps->i);
    if i+1<jsonb_array_length(ps) then roster:=roster||jsonb_build_array(ps->(i+1)); end if;
    gid:=arena_private.new_game(null,t.id,roster,t.rule_config,1);
    if jsonb_array_length(roster)=1 then update arena_private.games set state=state||jsonb_build_object('status','finished','winner',roster->0->>'id','message','Bye — advanced to next round') where id=gid; end if;
    i:=i+2;
   end loop;
  end if;
  select * into t from public.tournaments where id=t.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',display_name,'status',status) order by seed),'[]') into ps from public.tournament_players where tournament_id=t.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',gg.id,'round',gg.round_no,'status',gg.state->>'status','winner',gg.state->>'winner','players',(select jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name')) from jsonb_array_elements(gg.state->'players'))) order by gg.round_no,gg.id),'[]') into roster from arena_private.games gg where tournament_id=t.id;
  out:=jsonb_build_object('id',t.id,'name',t.name,'host',t.host_id,'me',uid,'startsAt',t.starts_at,'maxPlayers',t.max_players,'rules',t.rule_config,'status',t.status,'players',ps,'matches',roster);
 elsif action='history' then
  select coalesce(jsonb_agg(jsonb_build_object('game_id',g.id,'room_id',g.room_id,'room_code',r.code,'room_name',r.name,'tournament_id',g.tournament_id,'round',g.round_no,'status',g.state->>'status','turn_id',turn_player.value->>'id','turn_name',turn_player.value->>'name','my_turn',turn_player.value->>'id'=uid::text,'updated_at',g.updated_at,'message',coalesce(g.state->>'message',''),'player_count',jsonb_array_length(g.state->'players')) order by g.updated_at desc),'[]'::jsonb) into active_matches
  from arena_private.games g
  left join public.rooms r on r.id=g.room_id
  left join lateral (select p.value from jsonb_array_elements(g.state->'players') with ordinality as p(value,turn_index) where p.turn_index=(g.state->>'turn')::int+1) turn_player on true
  where g.state->>'status'='running' and exists(select 1 from jsonb_array_elements(g.state->'players') p where p->>'id'=uid::text);
  select coalesce(jsonb_agg(jsonb_build_object('game_id',rr.game_id,'score',rr.score,'won',rr.won,'created_at',rr.created_at,'tournament_id',gg.tournament_id,'room_id',gg.room_id,'room_code',r.code,'room_name',r.name,'round',gg.round_no,'winner_id',gg.state->>'winner','winner_name',winner_player.name) order by rr.created_at desc),'[]'::jsonb) into completed_matches
  from arena_private.results rr
  join arena_private.games gg on gg.id=rr.game_id
  left join public.rooms r on r.id=gg.room_id
  left join lateral (select p.value->>'name' as name from jsonb_array_elements(gg.state->'players') p(value) where p.value->>'id'=gg.state->>'winner' limit 1) winner_player on true
  where rr.user_id=uid;
  ps:=completed_matches;
  select coalesce(jsonb_agg(x),'[]') into roster from (select p.display_name,count(*) games,count(*) filter(where rr.won) wins from arena_private.results rr join public.profiles p on p.id=rr.user_id group by rr.user_id,p.display_name order by wins desc,games desc limit 25) x;
  out:=jsonb_build_object('active',active_matches,'completed',completed_matches,'history',ps,'leaderboard',roster);
 else raise exception 'Unknown action'; end if;
 if r.id is not null and action not in ('room','heartbeat') then perform arena_private.ping(r.id,null); end if;
 if t.id is not null and action<>'tournament' then perform arena_private.ping(null,t.id); end if;
 if req is not null then insert into arena_private.requests(user_id,request_id,result) values(uid,req,out); end if;
 return out;
end $$;
revoke all on function public.arena(text,jsonb) from public;
grant execute on function public.arena(text,jsonb) to anon,authenticated;
commit;


-- Match experience additions (2026-09-12)
-- Apply after the existing 20260911 migrations. Safe to reapply.
begin;
create table if not exists arena_private.move_log(game_id uuid references arena_private.games(id) on delete cascade,version int,message text not null,created_at timestamptz default now(),primary key(game_id,version));
create table if not exists arena_private.round_results(game_id uuid references arena_private.games(id) on delete cascade,round_no int,summary jsonb not null,primary key(game_id,round_no));
create table if not exists arena_private.reactions(id uuid primary key default gen_random_uuid(),game_id uuid references arena_private.games(id) on delete cascade,user_id uuid not null,message text not null,created_at timestamptz default now());
create index if not exists reactions_cooldown on arena_private.reactions(game_id,user_id,created_at desc);
revoke all on arena_private.move_log,arena_private.round_results,arena_private.reactions from public,anon,authenticated;
create or replace function arena_private.record_move() returns trigger language plpgsql as $$
begin
 if new.version<>old.version then insert into arena_private.move_log(game_id,version,message) values(new.id,new.version,coalesce(new.state->>'message','Turn updated')) on conflict do nothing; end if;
 return new;
end $$;
drop trigger if exists arena_record_move on arena_private.games;
create trigger arena_record_move after update on arena_private.games for each row execute function arena_private.record_move();
create or replace function arena_private.finish(gid uuid,s jsonb) returns jsonb language plpgsql as $$
declare p jsonb; i int:=0; score int; alive int; winner text:=s->>'winner'; roster jsonb; t uuid; eliminated_id text; eliminated_score int; fresh jsonb; eliminated jsonb; tally jsonb;
begin
 insert into arena_private.round_results(game_id,round_no,summary)
 values(gid,(s->>'round')::int,jsonb_build_object('round',(s->>'round')::int,'mode',s->'rules'->>'gameType','winner',s->>'winner','reason',case when s->>'winner' is not null then coalesce(s->>'message','Round complete') when s->'rules'->>'gameType'='tender' then 'Market exhausted: lowest total eliminated. Equal totals use player ID as a stable tie-break.' else 'Market exhausted: highest total loses.' end,'players',(select jsonb_agg(jsonb_build_object('id',rp->>'id','name',rp->>'name','cards',rp->'hand','score',(select coalesce(sum((rc->>'score')::int),0) from jsonb_array_elements(rp->'hand') rc))) from jsonb_array_elements(s->'players') rp where not coalesce((rp->>'eliminated')::boolean,false))))
 on conflict(game_id,round_no) do nothing;
 for p in select value from jsonb_array_elements(s->'players') loop
  select coalesce(sum((value->>'score')::int),0) into score from jsonb_array_elements(p->'hand');
  s:=jsonb_set(s,array['players',i::text,'roundScore'],to_jsonb(score));
  s:=jsonb_set(s,array['players',i::text,'total'],to_jsonb(coalesce((p->>'total')::int,0)+score));
  i:=i+1;
 end loop;
 if s->'rules'->>'gameType'='tender' and winner is null then
  select value->>'id',(value->>'roundScore')::int into eliminated_id,eliminated_score
  from jsonb_array_elements(s->'players')
  where not coalesce((value->>'eliminated')::boolean,false)
  order by (value->>'roundScore')::int,value->>'id' limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name','score',(value->>'roundScore')::int,'eliminated',value->>'id'=eliminated_id) order by (value->>'roundScore')::int,value->>'id'),'[]'::jsonb)
  into tally from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
  if eliminated_id is null then raise exception 'Tender table has no active players'; end if;
  i:=0;
  for p in select value from jsonb_array_elements(s->'players') loop
   if p->>'id'=eliminated_id then s:=jsonb_set(s,array['players',i::text,'eliminated'],'true'); end if;
   i:=i+1;
  end loop;
  select count(*) into alive from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
  if alive>1 then
   select jsonb_agg(value-'hand'-'roundScore') into roster from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
   fresh:=arena_private.deal(roster,s->'rules',(s->>'round')::int+1);
   select coalesce(jsonb_agg(value||jsonb_build_object('hand','[]'::jsonb,'eliminated',true)),'[]'::jsonb) into eliminated from jsonb_array_elements(s->'players') where coalesce((value->>'eliminated')::boolean,false);
   return fresh||jsonb_build_object('players',(fresh->'players')||eliminated,'tenderTally',tally,'message',(select value->>'name' from jsonb_array_elements(s->'players') where value->>'id'=eliminated_id limit 1)||' was eliminated with '||eliminated_score||' points. Next tender round.','event',jsonb_build_object('type','tender-elimination','actor',eliminated_id));
  end if;
  select value->>'id' into winner from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false) limit 1;
 elsif s->'rules'->>'gameType'='knockout' then
  i:=0;
  for p in select value from jsonb_array_elements(s->'players') loop
   if (p->>'total')::int>=(s->'rules'->>'targetScore')::int then s:=jsonb_set(s,array['players',i::text,'eliminated'],'true'); end if;
   i:=i+1;
  end loop;
  select count(*) into alive from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
  if alive>1 then
   select jsonb_agg(value-'hand'-'roundScore') into roster from jsonb_array_elements(s->'players') where not (value->>'eliminated')::boolean;
   declare fresh_round jsonb; eliminated_round jsonb; begin
    fresh_round:=arena_private.deal(roster,s->'rules',(s->>'round')::int+1);
    select coalesce(jsonb_agg(value||'{"hand":[]}'::jsonb),'[]') into eliminated_round from jsonb_array_elements(s->'players') where (value->>'eliminated')::boolean;
    return fresh_round||jsonb_build_object('players',(fresh_round->'players')||eliminated_round,'message','Round complete. Scores added; the next round is dealt.');
   end;
  end if;
  select value->>'id' into winner from jsonb_array_elements(s->'players') order by (value->>'total')::int,value->>'id' limit 1;
 end if;
 if tally is not null then s:=s||jsonb_build_object('tenderTally',tally); end if;
 s:=s||jsonb_build_object('status','finished','winner',winner,'deadline',null);
 for p in select value from jsonb_array_elements(s->'players') loop
  insert into arena_private.results(game_id,user_id,score,won) values(gid,(p->>'id')::uuid,(p->>'total')::int,p->>'id'=winner) on conflict do nothing;
 end loop;
 select tournament_id into t from arena_private.games where id=gid;
 if t is not null then update public.tournament_players set status='eliminated' where tournament_id=t and user_id<>winner::uuid and user_id in(select (value->>'id')::uuid from jsonb_array_elements(s->'players')); end if;
 return s;
end $$;


create or replace function arena_private.view_game(gid uuid,uid uuid) returns jsonb language plpgsql as $$
declare g arena_private.games; s jsonb; ps jsonb; me jsonb;
begin
 select * into g from arena_private.games where id=gid; s:=g.state;
 select value into me from jsonb_array_elements(s->'players') where value->>'id'=uid::text;
 if me is null then raise exception 'You are not in this match'; end if;
 select jsonb_agg((value-'hand')||jsonb_build_object('count',jsonb_array_length(value->'hand'))) into ps from jsonb_array_elements(s->'players');
 return (s-'deck'-'players'-'discard')||jsonb_build_object('id',g.id,'version',g.version,'players',ps,'hand',me->'hand','me',uid,
 'top',s->'discard'->(jsonb_array_length(s->'discard')-1),'marketCount',jsonb_array_length(s->'deck'),'tournamentId',g.tournament_id,'roomId',g.room_id,'serverTime',now(),
 'roomCode',(select vr.code from public.rooms vr where vr.id=g.room_id),
 'roomHost',(select vr.host_id from public.rooms vr where vr.id=g.room_id),
 'recentMoves',(select coalesce(jsonb_agg(log order by log.version),'[]') from (select ml.version,ml.message,ml.created_at from arena_private.move_log ml where ml.game_id=gid order by ml.version desc limit 30) log),
 'roundResults',(select coalesce(jsonb_agg(rr.summary order by rr.round_no),'[]') from arena_private.round_results rr where rr.game_id=gid),
 'reactions',(select coalesce(jsonb_agg(rx),'[]') from (select re.id,re.message,re.created_at,(select rp->>'name' from jsonb_array_elements(s->'players') rp where rp->>'id'=re.user_id::text) as name from arena_private.reactions re where re.game_id=gid and re.created_at>now()-interval '20 seconds' order by re.created_at desc limit 5) rx));
end $$;


create or replace function public.arena(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,arena_private,pg_temp as $$
declare uid uuid:=auth.uid(); r public.rooms; t public.tournaments; gid uuid; g arena_private.games; ps jsonb; out jsonb; cfg jsonb; n int; seat_no int; code text; nm text; req uuid; prior jsonb; lock_key text; i int; roster jsonb; active_matches jsonb; completed_matches jsonb;
begin
 if action='health' then return '{"schemaVersion":3}'::jsonb; end if;
 if uid is null then raise exception 'Sign in to continue'; end if;
 if jsonb_typeof(input)<>'object' or octet_length(input::text)>16000 then raise exception 'Invalid request'; end if;
 -- Shared scope lock prevents joins, starts and tournament advancement racing.
 if input ? 'game' then
  select * into g from arena_private.games where id=(input->>'game')::uuid;
  lock_key:=coalesce(g.tournament_id,g.room_id,g.id)::text;
 elsif input ? 'tournament' then lock_key:=input->>'tournament';
 elsif input ? 'code' then select * into r from public.rooms where rooms.code=upper(input->>'code'); lock_key:=r.id::text;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(lock_key,uid::text),0));
 if action not in ('room','game','tournament','history','heartbeat') then
  req:=(input->>'requestId')::uuid;
  if req is null then raise exception 'A request ID is required'; end if;
  select result into prior from arena_private.requests where user_id=uid and request_id=req;
  if found then return prior; end if;
 end if;
 select coalesce(nullif(display_name,''),'Player') into nm from public.profiles where id=uid;
 nm:=coalesce(nm,'Player');
 if action='createRoom' then
  cfg:=arena_private.rules(input->'rules'); n:=(input->>'maxPlayers')::int;
  if n is null or n not between 2 and 8 or length(trim(input->>'name')) not between 1 and 80 then raise exception 'Enter a name and 2–8 seats'; end if;
  perform arena_private.validate_room_config(cfg,n);
  if (select count(*) from public.rooms where host_id=uid and status='waiting')>=10 then raise exception 'Close an existing waiting room first'; end if;
  loop
   code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
   begin
    insert into public.rooms(code,name,host_id,max_players,rule_config,mode) values(code,trim(input->>'name'),uid,n,cfg,cfg->>'gameType') returning * into r; exit;
   exception when unique_violation then null; end;
  end loop;
  insert into public.room_players(room_id,user_id,display_name,seat,ready) values(r.id,uid,nm,1,true);
  out:=jsonb_build_object('code',r.code);
 elsif action in ('room','joinRoom','ready','leaveRoom','startRoom','settings','rematch','heartbeat') then
  select * into r from public.rooms where rooms.code=upper(input->>'code') for update;
  if not found then raise exception 'Room not found'; end if;
  if action='joinRoom' then
   if exists(select 1 from public.room_players where room_id=r.id and user_id=uid) then null;
   else
    if r.status<>'waiting' then raise exception 'This table has started'; end if;
    select x into seat_no from generate_series(1,r.max_players) x where not exists(select 1 from public.room_players where room_id=r.id and seat=x) limit 1;
    if seat_no is null then raise exception 'This table is full'; end if;
    insert into public.room_players(room_id,user_id,display_name,seat) values(r.id,uid,nm,seat_no);
   end if;
  end if;
  if not exists(select 1 from public.room_players where room_id=r.id and user_id=uid) then raise exception 'Join this table using its code first'; end if;
  insert into arena_private.visits(room_id,user_id) values(r.id,uid) on conflict(room_id,user_id) do update set seen_at=now();
  if action='ready' then
   if r.status<>'waiting' then raise exception 'This table has started'; end if;
   update public.room_players set ready=(input->>'ready')::boolean where room_id=r.id and user_id=uid;
  elsif action='settings' then
   if r.host_id<>uid or r.status<>'waiting' then raise exception 'Only the host can change waiting room rules'; end if;
   cfg:=arena_private.rules(input->'rules');
   perform arena_private.validate_room_config(cfg,r.max_players);
   update public.rooms set rule_config=cfg,mode=cfg->>'gameType' where id=r.id;
   update public.room_players set ready=false where room_id=r.id;
  elsif action in ('startRoom','rematch') then
   if r.host_id<>uid then raise exception 'Only the host can start'; end if;
   if action='rematch' then
    if r.status<>'finished' then raise exception 'Finish the current match first'; end if;
    update public.rooms set status='waiting',active_match_id=null where id=r.id;
    update public.room_players set ready=false where room_id=r.id;
   else
    if r.status<>'waiting' then raise exception 'This table has already started'; end if;
    if (select count(*) from public.room_players where room_id=r.id)<2 or exists(select 1 from public.room_players where room_id=r.id and not ready) then raise exception 'Every player must be ready'; end if;
    select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) order by seat) into ps from public.room_players where room_id=r.id;
    cfg:=arena_private.rules(r.rule_config);
    perform arena_private.validate_room_config(cfg,r.max_players);
    gid:=arena_private.new_game(r.id,null,ps,cfg);
    update public.rooms set status='running' where id=r.id;
   end if;
  elsif action='leaveRoom' then
   if r.status='running' then raise exception 'Forfeit the match before leaving the table'; end if;
   delete from public.room_players where room_id=r.id and user_id=uid;
   if r.host_id=uid then
    if exists(select 1 from public.room_players where room_id=r.id) then update public.rooms set host_id=(select user_id from public.room_players where room_id=r.id order by seat limit 1) where id=r.id;
    else update public.rooms set status='cancelled' where id=r.id; end if;
   end if;
   out:='{"left":true}';
  end if;
  if out is null then
   select * into r from public.rooms where id=r.id;
   select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.display_name,'seat',p.seat,'ready',p.ready,'connected',coalesce(v.seen_at>now()-interval '35 seconds',false)) order by p.seat) into ps from public.room_players p left join arena_private.visits v on v.room_id=p.room_id and v.user_id=p.user_id where p.room_id=r.id;
   select id into gid from arena_private.games where room_id=r.id order by updated_at desc limit 1;
   out:=jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'host',r.host_id,'me',uid,'maxPlayers',r.max_players,'rules',r.rule_config,'status',r.status,'players',coalesce(ps,'[]'),'game',gid);
  end if;
 elsif action='react' then
  gid:=(input->>'game')::uuid;
  perform arena_private.view_game(gid,uid);
  select * into g from arena_private.games where id=gid;
  if g.room_id is null or g.state->>'status'<>'running' then raise exception 'Reactions are only available in active private tables'; end if;
  if input->>'reaction' is null or input->>'reaction' not in ('Nice move!','Good game!','Well played!','Thinking…') then raise exception 'Choose a preset reaction'; end if;
  if exists(select 1 from arena_private.reactions rx where rx.game_id=gid and rx.user_id=uid and rx.created_at>now()-interval '5 seconds') then raise exception 'Wait a moment before another reaction'; end if;
  insert into arena_private.reactions(game_id,user_id,message) values(gid,uid,input->>'reaction');
  perform arena_private.ping(g.room_id,null);
  out:=arena_private.view_game(gid,uid);
 elsif action in ('game','play','draw','timeout','forfeit') then
  gid:=(input->>'game')::uuid;
  if action<>'game' then perform arena_private.move(gid,uid,action,input); end if;
  out:=arena_private.view_game(gid,uid);
 elsif action='createTournament' then
  cfg:=arena_private.rules(input->'rules'); n:=(input->>'maxPlayers')::int;
  if n is null or n not between 4 and 128 or length(trim(input->>'name')) not between 1 and 80 or (input->>'startsAt')::timestamptz<now() then raise exception 'Choose a future time, name and 4–128 seats'; end if;
  if (select count(*) from public.tournaments where host_id=uid and status='registration')>=5 then raise exception 'Start or cancel an existing event first'; end if;
  insert into public.tournaments(name,host_id,starts_at,max_players,rule_config) values(trim(input->>'name'),uid,(input->>'startsAt')::timestamptz,n,cfg) returning * into t;
  insert into public.tournament_players(tournament_id,user_id,display_name,seed) values(t.id,uid,nm,1);
  out:=jsonb_build_object('id',t.id);
 elsif action in ('tournament','joinTournament','withdrawTournament','startTournament','cancelTournament') then
  select * into t from public.tournaments where id=(input->>'tournament')::uuid for update;
  if not found then raise exception 'Tournament not found'; end if;
  if action='joinTournament' then
   if t.status<>'registration' then raise exception 'Registration is closed'; end if;
   if not exists(select 1 from public.tournament_players where tournament_id=t.id and user_id=uid) then
    select count(*) into n from public.tournament_players where tournament_id=t.id;
    if n>=t.max_players then raise exception 'The tournament is full'; end if;
    insert into public.tournament_players(tournament_id,user_id,display_name,seed) values(t.id,uid,left(coalesce(nullif(trim(input->>'name'),''),nm),40),n+1);
   end if;
  elsif action='withdrawTournament' then
   if t.status<>'registration' then raise exception 'Registration is closed. Forfeit your current match to withdraw.'; end if;
   delete from public.tournament_players where tournament_id=t.id and user_id=uid;
  elsif action='cancelTournament' then
   if t.host_id<>uid or t.status<>'registration' then raise exception 'Only the host can cancel before starting'; end if;
   update public.tournaments set status='cancelled' where id=t.id;
  elsif action='startTournament' then
   if t.host_id<>uid or t.status<>'registration' then raise exception 'Only the host can start an open tournament'; end if;
   select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) order by gen_random_uuid()) into ps from public.tournament_players where tournament_id=t.id;
   if coalesce(jsonb_array_length(ps),0)<2 then raise exception 'At least two players are required'; end if;
   update public.tournaments set status='running' where id=t.id;
   update public.tournament_players set status='active' where tournament_id=t.id;
   i:=0;
   while i<jsonb_array_length(ps) loop
    roster:=jsonb_build_array(ps->i);
    if i+1<jsonb_array_length(ps) then roster:=roster||jsonb_build_array(ps->(i+1)); end if;
    gid:=arena_private.new_game(null,t.id,roster,t.rule_config,1);
    if jsonb_array_length(roster)=1 then update arena_private.games set state=state||jsonb_build_object('status','finished','winner',roster->0->>'id','message','Bye — advanced to next round') where id=gid; end if;
    i:=i+2;
   end loop;
  end if;
  select * into t from public.tournaments where id=t.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',display_name,'status',status) order by seed),'[]') into ps from public.tournament_players where tournament_id=t.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',gg.id,'round',gg.round_no,'status',gg.state->>'status','winner',gg.state->>'winner','players',(select jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name')) from jsonb_array_elements(gg.state->'players'))) order by gg.round_no,gg.id),'[]') into roster from arena_private.games gg where tournament_id=t.id;
  out:=jsonb_build_object('id',t.id,'name',t.name,'host',t.host_id,'me',uid,'startsAt',t.starts_at,'maxPlayers',t.max_players,'rules',t.rule_config,'status',t.status,'players',ps,'matches',roster);
 elsif action='history' then
  select coalesce(jsonb_agg(jsonb_build_object('game_id',hg.id,'room_id',hg.room_id,'room_code',hr.code,'room_name',hr.name,'tournament_id',hg.tournament_id,'round',hg.round_no,'status',hg.state->>'status','turn_id',turn_player.value->>'id','turn_name',turn_player.value->>'name','my_turn',turn_player.value->>'id'=uid::text,'updated_at',hg.updated_at,'message',coalesce(hg.state->>'message',''),'player_count',jsonb_array_length(hg.state->'players')) order by hg.updated_at desc),'[]'::jsonb) into active_matches
  from arena_private.games hg
  left join public.rooms hr on hr.id=hg.room_id
  left join lateral (select p.value from jsonb_array_elements(hg.state->'players') with ordinality as p(value,turn_index) where p.turn_index=(hg.state->>'turn')::int+1) turn_player on true
  where hg.state->>'status'='running' and exists(select 1 from jsonb_array_elements(hg.state->'players') p where p->>'id'=uid::text);
  select coalesce(jsonb_agg(jsonb_build_object('game_id',rr.game_id,'score',rr.score,'won',rr.won,'created_at',rr.created_at,'tournament_id',gg.tournament_id,'room_id',gg.room_id,'room_code',hr.code,'room_name',hr.name,'round',gg.round_no,'winner_id',gg.state->>'winner','winner_name',winner_player.name,'mode',gg.state->'rules'->>'gameType') order by rr.created_at desc),'[]'::jsonb) into completed_matches
  from arena_private.results rr
  join arena_private.games gg on gg.id=rr.game_id
  left join public.rooms hr on hr.id=gg.room_id
  left join lateral (select p.value->>'name' as name from jsonb_array_elements(gg.state->'players') p(value) where p.value->>'id'=gg.state->>'winner' limit 1) winner_player on true
  where rr.user_id=uid;
  ps:=completed_matches;
  select coalesce(jsonb_agg(x),'[]') into roster from (select p.display_name,count(*) games,count(*) filter(where rr.won) wins from arena_private.results rr join public.profiles p on p.id=rr.user_id group by rr.user_id,p.display_name order by wins desc,games desc limit 25) x;
  out:=jsonb_build_object('active',active_matches,'completed',completed_matches,'history',ps,'leaderboard',roster,'stats',(select coalesce(jsonb_agg(stat),'[]') from (select sg.state->'rules'->>'gameType' as mode,count(*) as played,count(*) filter(where sr.won) as wins from arena_private.results sr join arena_private.games sg on sg.id=sr.game_id where sr.user_id=uid group by sg.state->'rules'->>'gameType') stat));
 else raise exception 'Unknown action'; end if;
 if r.id is not null and action not in ('room','heartbeat') then perform arena_private.ping(r.id,null); end if;
 if t.id is not null and action<>'tournament' then perform arena_private.ping(null,t.id); end if;
 if req is not null then insert into arena_private.requests(user_id,request_id,result) values(uid,req,out); end if;
 return out;
end $$;

revoke all on all functions in schema arena_private from public,anon,authenticated;
revoke all on function public.arena(text,jsonb) from public;
grant execute on function public.arena(text,jsonb) to anon,authenticated;
commit;
