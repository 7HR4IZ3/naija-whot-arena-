-- Optional for fully unattended timers; run after enabling Supabase Cron (pg_cron).
begin;
create or replace function arena_private.expire_turns() returns void language plpgsql security definer set search_path=public,arena_private,pg_temp as $$
declare g arena_private.games;
begin
 for g in select * from arena_private.games where state->>'status'='running' and (state->>'deadline')::timestamptz<=now() order by updated_at limit 100 loop
  if pg_try_advisory_xact_lock(hashtextextended(coalesce(g.tournament_id,g.room_id,g.id)::text,0)) then
   begin
    perform arena_private.move(g.id,(g.state->'players'->(g.state->>'turn')::int->>'id')::uuid,'timeout','{}');
   exception when raise_exception then null; end;
  end if;
 end loop;
 delete from arena_private.requests where created_at<now()-interval '7 days';
end $$;
revoke all on function arena_private.expire_turns() from public,anon,authenticated;
select cron.schedule('whot-expired-turns','5 seconds','select arena_private.expire_turns()');
commit;
