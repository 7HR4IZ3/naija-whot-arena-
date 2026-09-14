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

create or replace function arena_private.start_knockout_round(gid uuid,uid uuid,expected_version int) returns void language plpgsql as $$
declare g arena_private.games; s jsonb; roster jsonb; fresh jsonb; eliminated jsonb;
begin
 select * into g from arena_private.games where id=gid for update;
 if not found then raise exception 'Game not found'; end if;
 s:=g.state;
 if s->>'status'<>'round-complete' then raise exception 'This round is not waiting to be started'; end if;
 if expected_version is null or expected_version<>g.version then raise exception 'Table changed. Refresh before starting the next round.'; end if;
 if not exists(select 1 from jsonb_array_elements(s->'players') where value->>'id'=uid::text and not coalesce((value->>'eliminated')::boolean,false)) then raise exception 'Only an active player can start the next round'; end if;
 select coalesce(jsonb_agg(value-'hand'-'roundScore' order by ordinality),'[]'::jsonb)
 into roster
 from jsonb_array_elements(s->'players') with ordinality as player(value,ordinality)
 where not coalesce((value->>'eliminated')::boolean,false);
 fresh:=arena_private.deal(roster,s->'rules',(s->>'round')::int+1);
 select coalesce(jsonb_agg((value-'hand')||jsonb_build_object('hand','[]'::jsonb) order by ordinality),'[]'::jsonb)
 into eliminated
 from jsonb_array_elements(s->'players') with ordinality as player(value,ordinality)
 where coalesce((value->>'eliminated')::boolean,false);
 fresh:=fresh||jsonb_build_object(
  'players',(fresh->'players')||eliminated,
  'message','Round '||(s->>'round')||' complete. The next knockout round is ready.',
  'event',jsonb_build_object('type','knockout-round-start','actor',uid::text)
 );
 update arena_private.games set state=fresh,version=version+1,updated_at=now() where id=gid;
 perform arena_private.ping(g.room_id,g.tournament_id);
end $$;

create or replace function arena_private.finish(gid uuid,s jsonb) returns jsonb language plpgsql as $$
declare p jsonb; i int:=0; score int; alive int; winner text:=s->>'winner'; roster jsonb; t uuid; eliminated_id text; eliminated_score int; fresh jsonb; eliminated jsonb; tally jsonb;
begin
 insert into arena_private.round_results(game_id,round_no,summary)
 values(gid,(s->>'round')::int,jsonb_build_object('round',(s->>'round')::int,'mode',s->'rules'->>'gameType','winner',s->>'winner','reason',case when s->'rules'->>'gameType'='knockout' then 'Normal round complete: the highest hand total was eliminated. Equal totals use player ID as a stable tie-break.' when s->>'winner' is not null then coalesce(s->>'message','Round complete') when s->'rules'->>'gameType'='tender' then 'Market exhausted: lowest total eliminated. Equal totals use player ID as a stable tie-break.' else 'Market exhausted: highest total loses.' end,'players',(select jsonb_agg(jsonb_build_object('id',rp->>'id','name',rp->>'name','cards',rp->'hand','score',(select coalesce(sum((rc->>'score')::int),0) from jsonb_array_elements(rp->'hand') rc))) from jsonb_array_elements(s->'players') rp where not coalesce((rp->>'eliminated')::boolean,false))))
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
 elsif s->'rules'->>'gameType'='knockout' and s->'event'->>'type' is distinct from 'forfeit' then
  select value->>'id',(value->>'roundScore')::int into eliminated_id,eliminated_score
  from jsonb_array_elements(s->'players')
  where not coalesce((value->>'eliminated')::boolean,false)
  order by (value->>'roundScore')::int desc,value->>'id' limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name','score',(value->>'roundScore')::int,'eliminated',value->>'id'=eliminated_id) order by (value->>'roundScore')::int desc,value->>'id'),'[]'::jsonb)
  into tally from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
  if eliminated_id is null then raise exception 'Knockout table has no active players'; end if;
  i:=0;
  for p in select value from jsonb_array_elements(s->'players') loop
   if p->>'id'=eliminated_id then s:=jsonb_set(s,array['players',i::text,'eliminated'],'true'); end if;
   i:=i+1;
  end loop;
  select count(*) into alive from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false);
  if alive>1 then
   return s||jsonb_build_object('status','round-complete','winner',winner,'deadline',null,'knockoutTally',tally,
    'message',(select value->>'name' from jsonb_array_elements(s->'players') where value->>'id'=eliminated_id limit 1)||' was eliminated with '||eliminated_score||' points. Start the next round when ready.',
    'event',jsonb_build_object('type','knockout-round-complete','actor',eliminated_id));
  end if;
  select value->>'id' into winner from jsonb_array_elements(s->'players') where not coalesce((value->>'eliminated')::boolean,false) limit 1;
 end if;
 if tally is not null then s:=s||jsonb_build_object(case when s->'rules'->>'gameType'='tender' then 'tenderTally' else 'knockoutTally' end,tally); end if;
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
 if action='health' then return '{"schemaVersion":4}'::jsonb; end if;
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
 elsif action='nextRound' then
  gid:=(input->>'game')::uuid;
  perform arena_private.start_knockout_round(gid,uid,(input->>'version')::int);
  out:=arena_private.view_game(gid,uid);
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
  where hg.state->>'status' in ('running','round-complete') and exists(select 1 from jsonb_array_elements(hg.state->'players') p where p->>'id'=uid::text);
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
