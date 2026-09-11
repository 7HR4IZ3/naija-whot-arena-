import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
// Run with PGLITE_PATH pointing to an installed @electric-sql/pglite dist/index.js.
const { PGlite } = await import(process.env.PGLITE_PATH || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
await db.exec(readFileSync('supabase/setup.sql','utf8').replace('create extension if not exists pgcrypto;',''));
const users=Array.from({length:5},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
for(const u of users) await db.query(`insert into auth.users(id,email) values($1,$2)`,[u,`${u}@test.invalid`]);
async function rpc(u,action,input={}) {
 await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[u]);
 return (await db.query(`select public.arena($1,$2) result`,[action,JSON.stringify({requestId:crypto.randomUUID(),...input})])).rows[0].result;
}
const room=await rpc(users[0],'createRoom',{name:'Test',maxPlayers:2,rules:{turnTimer:'off'}});
await rpc(users[1],'joinRoom',{code:room.code});
await assert.rejects(()=>rpc(users[2],'joinRoom',{code:room.code}),/full/);
await assert.rejects(()=>rpc(users[1],'startRoom',{code:room.code}),/host/);
await assert.rejects(()=>rpc(users[0],'startRoom',{code:room.code}),/ready/);
await rpc(users[1],'ready',{code:room.code,ready:true});
const started=await rpc(users[0],'startRoom',{code:room.code});
let game=await rpc(users[0],'game',{game:started.game});
assert.equal(game.hand.length,6); assert.equal(game.marketCount,41);
assert.equal(game.deck,undefined); assert.equal(game.players[1].hand,undefined);
await assert.rejects(()=>rpc(users[2],'game',{game:game.id}),/not in/);
await assert.rejects(()=>rpc(users[1],'draw',{game:game.id,version:game.version}),/turn/);
await assert.rejects(()=>rpc(users[0],'draw',{game:game.id,version:0}),/changed/);
const req=crypto.randomUUID();
const move=await rpc(users[0],'draw',{game:game.id,version:game.version,requestId:req});
const duplicate=await rpc(users[0],'draw',{game:game.id,version:game.version,requestId:req});
assert.equal(move.version,duplicate.version);
await rpc(users[1],'forfeit',{game:move.id,version:move.version});
const history=await rpc(users[0],'history'); assert.equal(history.history[0].won,true);
const tournament=await rpc(users[0],'createTournament',{name:'Bracket test',startsAt:'2099-01-01T12:00:00Z',maxPlayers:8,rules:{turnTimer:'off'}});
for(const u of users.slice(1)) await rpc(u,'joinTournament',{tournament:tournament.id});
let bracket=await rpc(users[0],'startTournament',{tournament:tournament.id});
assert.equal(bracket.matches.length,3);
while(bracket.status==='running') {
 for(const m of bracket.matches.filter(x=>x.status==='running')) {
  const v=await rpc(m.players[0].id,'game',{game:m.id});
  await rpc(m.players[0].id,'forfeit',{game:m.id,version:v.version});
 }
 bracket=await rpc(users[0],'tournament',{tournament:tournament.id});
}
assert.equal(bracket.players.filter(p=>p.status==='winner').length,1);
// Direct client writes and hidden reads are blocked even if old RLS policies exist.
await db.exec('set role authenticated');
await assert.rejects(()=>db.query('select * from arena_private.games'),/permission denied/);
await assert.rejects(()=>db.query('select * from public.matches'),/permission denied/);
await assert.rejects(()=>db.query("update public.rooms set status='running'"),/permission denied/);
await db.exec('reset role');
// Exercise complete real server games, including multi-player action cards and knockout.
let simulationMoves=0;
for(let sim=0;sim<12;sim++) {
 const size=2+sim%4;
 const rules={turnTimer:'off',gameType:sim%3===0?'knockout':'classic',targetScore:50,drawMode:sim%2?'until-playable':'one',pickTwoMode:['stack','block','none'][sim%3],pickThreeMode:['stack','block','none'][sim%3],whotEnabled:sim%4!==0};
 const room=await rpc(users[0],'createRoom',{name:`Simulation ${sim}`,maxPlayers:size,rules});
 for(const u of users.slice(1,size)){await rpc(u,'joinRoom',{code:room.code});await rpc(u,'ready',{code:room.code,ready:true});}
 const roomView=await rpc(users[0],'startRoom',{code:room.code});
 let view=await rpc(users[0],'game',{game:roomView.game});
 for(let step=0;step<1500 && view.status==='running';step++) {
  const state=(await db.query('select state from arena_private.games where id=$1',[view.id])).rows[0].state;
  const cards=[...state.deck,...state.discard,...state.players.flatMap(p=>p.hand)];
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length,'duplicate card');
  assert.equal(cards.length,rules.whotEnabled?54:49,'card lost');
  const actor=state.players[state.turn];
  const playable=(await db.query(`select value from jsonb_array_elements($1::jsonb) where arena_private.playable($2::jsonb,value) limit 1`,[JSON.stringify(actor.hand),JSON.stringify(state)])).rows[0]?.value;
  view=await rpc(actor.id,playable?'play':'draw',{game:view.id,version:view.version,card:playable?.id,suit:'circle'});
  simulationMoves++;
 }
 assert.equal(view.status,'finished',`simulation ${sim} never completed`);
}
// Inject a deterministic penalty position to test the Nigerian 5 = pick THREE rule.
const testRoom=await rpc(users[0],'createRoom',{name:'Penalty test',maxPlayers:2,rules:{turnTimer:'off'}});
await rpc(users[1],'joinRoom',{code:testRoom.code}); await rpc(users[1],'ready',{code:testRoom.code,ready:true});
const testStart=await rpc(users[0],'startRoom',{code:testRoom.code});
let fixture=(await db.query('select state from arena_private.games where id=$1',[testStart.game])).rows[0].state;
fixture.players[0].hand=[{id:'test5',suit:'circle',value:5,score:5},{id:'spare',suit:'star',value:7,score:14}];
fixture.discard=[{id:'opening',suit:'circle',value:4,score:4}];
await db.query('update arena_private.games set state=$1 where id=$2',[JSON.stringify(fixture),testStart.game]);
let testView=await rpc(users[0],'play',{game:testStart.game,version:1,card:'test5'});
assert.equal(testView.penalty,3);
const before=testView.players[1].count;
testView=await rpc(users[1],'draw',{game:testView.id,version:testView.version}); assert.equal(testView.hand.length,before+3);
await db.query(`update arena_private.games set state=state||jsonb_build_object('deadline',now()-interval '1 second') where id=$1`,[testView.id]);
await assert.rejects(()=>rpc(users[0],'draw',{game:testView.id,version:testView.version}),/expired/);
testView=await rpc(users[1],'timeout',{game:testView.id}); assert.equal(testView.turn,1);
console.log(`PASS: ${simulationMoves} validated moves across 12 full games; 2–5 players, knockout, draw modes, defence modes, deck conservation, pick-three and expired turns`);
console.log('PASS: schema, auth checks, ready/host/capacity guards, private hands, stale moves, idempotency, results, five-player bracket and legacy permission isolation');
await db.close();
