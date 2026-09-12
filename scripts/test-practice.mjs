import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require=createRequire(import.meta.url);
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {dealPractice,practiceMove,botChoice}=require('../lib/practice-engine.ts');
const {DEFAULT_ROOM_SETTINGS}=require('../lib/rules.ts');
let moves=0,games=0,finished=0;
for(const size of [2,3,4]) for(const mode of ['classic','tender','knockout']) for(const difficulty of ['easy','standard','hard']) for(const market of ['score','recycle']) {
 const rules={...DEFAULT_ROOM_SETTINGS,gameType:mode,targetScore:50,emptyMarketMode:market,whotEnabled:games%2===0,drawMode:games%2?'until-playable':'one',pickTwoMode:['stack','block','none'][games%3],pickThreeMode:['none','stack','block'][games%3],clockwise:games%2===0};
 let s=dealPractice(size,rules);
 assert.equal(practiceMove(s,'outsider'),s);
 assert.equal(practiceMove(s,'0','missing-card'),s);
 for(let step=0;step<1500 && !s.winner;step++){
  const cards=[...s.deck,...s.discard,...s.players.flatMap(p=>p.hand)];
  assert.equal(cards.length,rules.whotEnabled?54:49,'card conservation');
  assert.equal(new Set(cards.map(c=>c.id)).size,cards.length,'duplicate cards');
  assert.equal(s.players[s.turn].eliminated,false);
  const choice=botChoice(s,difficulty), next=practiceMove(s,s.players[s.turn].id,choice.cardId,choice.suit);
  assert.notEqual(next,s,'bot chose invalid move');
  s=next;moves++;
 }
 if(market==='score') assert.ok(s.winner,`${size}/${mode}/${difficulty}/${market} failed to complete`);
 if(s.winner){finished++;assert.ok(s.rounds.length);} assert.ok(s.moves.length<=30);
 games++;
}
console.log(`PASS: ${games} practice simulations (${finished} completed) and ${moves} moves; 2–4 seats, three difficulties, all modes, both market rules, deck conservation and turn guards`);
