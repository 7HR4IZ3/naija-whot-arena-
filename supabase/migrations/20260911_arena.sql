-- Apply AFTER supabase/schema.sql. All gameplay writes go through arena().
begin;
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
declare d jsonb := '{"gameType":"classic","initialHand":6,"drawMode":"one","turnTimer":"10","targetScore":100,"clockwise":true,"endCalls":true,"starDouble":true,"whotEnabled":true,"whotCallsSuit":true,"holdOnEnabled":true,"pickTwoEnabled":true,"pickTwoMode":"stack","pickThreeEnabled":true,"pickThreeMode":"stack","suspensionEnabled":true,"generalMarketEnabled":true}'; k text;
begin
 if v is null then return d; end if;
 if jsonb_typeof(v)<>'object' then raise exception 'Invalid rules'; end if;
 for k in select jsonb_object_keys(d) loop
  if v ? k then
   if jsonb_typeof(v->k)<>jsonb_typeof(d->k) then raise exception 'Invalid rule: %',k; end if;
   d:=jsonb_set(d,array[k],v->k);
  end if;
 end loop;
 if d->>'gameType' not in ('classic','knockout') or d->>'drawMode' not in ('one','until-playable')
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
  if jsonb_array_length(d)=0 and jsonb_array_length(pile)>1 then
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
    exit when jsonb_array_length(s->'deck')=0 and jsonb_array_length(s->'discard')<=1;
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
   s:=s||'{"message":"Market blocked. Lowest hand score wins; tied scores use seat identity order."}'::jsonb;
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
declare uid uuid:=auth.uid(); r public.rooms; t public.tournaments; gid uuid; g arena_private.games; ps jsonb; out jsonb; cfg jsonb; n int; seat_no int; code text; nm text; req uuid; prior jsonb; lock_key text; i int; roster jsonb;
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
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]') into ps from (select rr.game_id,rr.score,rr.won,rr.created_at,gg.tournament_id,gg.room_id from arena_private.results rr join arena_private.games gg on gg.id=rr.game_id where rr.user_id=uid order by rr.created_at desc limit 50) x;
  select coalesce(jsonb_agg(x),'[]') into roster from (select p.display_name,count(*) games,count(*) filter(where rr.won) wins from arena_private.results rr join public.profiles p on p.id=rr.user_id group by rr.user_id,p.display_name order by wins desc,games desc limit 25) x;
  out:=jsonb_build_object('history',ps,'leaderboard',roster);
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
