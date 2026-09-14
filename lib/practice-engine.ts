import { buildDeck, shuffle, SUITS, SUIT_META, type Card, type PlayingSuit } from "./cards";
import { DEFAULT_ROOM_SETTINGS, actionEnabled, penaltyMode, type RoomSettings } from "./rules";
export type Difficulty = "easy" | "standard" | "hard";
type Seat = { id: string; name: string; hand: Card[]; total: number; eliminated: boolean };
export type PracticeRound = { round: number; mode: string; winner: string | null; reason: string; players: {id:string;name:string;score:number;cards:Card[]}[] };
export type PracticeTally = { id: string; name: string; score: number; eliminated: boolean };
export type PracticeState = {
 players: Seat[]; deck: Card[]; discard: Card[]; turn: number; calledSuit: PlayingSuit | null;
 passes: number; penalty: number; penaltyType: 2 | 5 | null; rules: RoomSettings; round: number;
 winner: string | null; status: "running" | "round-complete" | "finished"; knockoutTally?: PracticeTally[]; version: number; message: string; moves: {version:number;message:string}[]; rounds: PracticeRound[];
};
export function dealPractice(count: number, rules: RoomSettings = DEFAULT_ROOM_SETTINGS): PracticeState {
 const deck=shuffle(buildDeck().filter(c=>rules.whotEnabled || c.suit!=="whot")).map(c=>({...c,score:c.suit==="star" && !rules.starDouble ? c.value : c.score}));
 const opening=deck.findIndex(c=>c.suit!=="whot" && !actionEnabled(c.value,rules));
 const top=deck.splice(opening<0?0:opening,1)[0];
 const players=Array.from({length:Math.min(4,Math.max(2,count))},(_,i)=>({id:String(i),name:["You","Amaka","Chidi","Bola"][i],hand:deck.splice(0,rules.initialHand),total:0,eliminated:false}));
 return {players,deck,discard:[top],turn:0,calledSuit:null,passes:0,penalty:0,penaltyType:null,rules,round:1,winner:null,status:"running",version:1,message:"Your turn. Match the number or symbol.",moves:[],rounds:[]};
}
export function practiceCanPlay(s:PracticeState,c:Card) {
 if(c.suit==="whot" && !s.rules.whotEnabled)return false;
 if(s.penalty)return c.value===s.penaltyType && penaltyMode(s.penaltyType!,s.rules)!=="none";
 const top=s.discard[s.discard.length-1];
 return c.suit==="whot" || (s.calledSuit ? c.suit===s.calledSuit : top.suit==="whot" || c.suit===top.suit || c.value===top.value);
}
function nextSeat(s:PracticeState,index:number,steps=1){
 const direction=s.rules.clockwise?1:-1;
 for(let step=0;step<steps;step++){do{index=(index+direction+s.players.length)%s.players.length;}while(s.players[index].eliminated);}
 return index;
}
function take(s:PracticeState,index:number,count:number){
 let drawn=0;
 for(let n=0;n<count;n++){
  if(!s.deck.length && s.rules.emptyMarketMode==="recycle" && s.discard.length>1){const top=s.discard.pop()!;s.deck=shuffle(s.discard);s.discard=[top];}
  const c=s.deck.pop();if(!c)break;s.players[index].hand.push(c);drawn++;
 }
 return drawn;
}
function finishRound(s:PracticeState,winner:string|null,reason:string){
 const active=s.players.filter(p=>!p.eliminated);
 const scores=active.map(p=>({id:p.id,name:p.name,score:p.hand.reduce((n,c)=>n+c.score,0),cards:[...p.hand]}));
 let eliminated:string|null=null;
 if(s.rules.gameType==="tender" && winner===null){
  eliminated=[...scores].sort((a,b)=>a.score-b.score || Number(a.id)-Number(b.id))[0].id;
  reason="Market empty: lowest total eliminated. Ties use seat order.";
 } else if(winner===null){winner=[...scores].sort((a,b)=>a.score-b.score || Number(a.id)-Number(b.id))[0].id;reason="Market empty: lowest total wins; highest total loses. Ties use seat order.";}
 if(s.rules.gameType==="knockout"){
  eliminated=[...scores].sort((a,b)=>b.score-a.score || Number(a.id)-Number(b.id))[0].id;
  reason=winner===null ? "Market empty: the highest hand total is eliminated. Ties use seat order." : reason+" The highest hand total is eliminated.";
  s.knockoutTally=scores.map(player=>({id:player.id,name:player.name,score:player.score,eliminated:player.id===eliminated}));
 }
 for(const p of active){p.total+=scores.find(v=>v.id===p.id)!.score;if(p.id===eliminated)p.eliminated=true;}
 s.rounds.push({round:s.round,mode:s.rules.gameType,winner,reason,players:scores});
 const remaining=s.players.filter(p=>!p.eliminated);
 if(s.rules.gameType==="knockout" && remaining.length>1){
  s.status="round-complete";s.turn=-1;s.winner=null;s.message=reason+" Start the next round when ready.";return;
 }
 if((s.rules.gameType==="tender" && eliminated!==null || s.rules.gameType==="knockout") && remaining.length>1){
  const fresh=dealPractice(remaining.length,s.rules);
  remaining.forEach((p,i)=>{p.hand=fresh.players[i].hand;});
  s.players.filter(p=>p.eliminated).forEach(p=>{p.hand=[];});
  s.deck=fresh.deck;s.discard=fresh.discard;s.calledSuit=null;s.penalty=0;s.penaltyType=null;s.turn=s.players.findIndex(p=>!p.eliminated);s.passes=0;s.round++;s.status="running";s.message=reason+" Next round dealt.";
 } else {
  s.status="finished";s.winner=s.rules.gameType==="knockout" || eliminated!==null ? remaining[0].id : winner;
  s.message=reason+" "+s.players.find(p=>p.id===s.winner)!.name+" won.";
 }
}
export function practiceNextRound(state: PracticeState): PracticeState {
 if(state.status!=="round-complete")return state;
 const s=structuredClone(state);const active=s.players.filter(p=>!p.eliminated);const fresh=dealPractice(active.length,s.rules);
 active.forEach((player,index)=>{player.hand=fresh.players[index].hand;});
 s.players.filter(p=>p.eliminated).forEach(player=>{player.hand=[];});
 s.deck=fresh.deck;s.discard=fresh.discard;s.calledSuit=null;s.penalty=0;s.penaltyType=null;s.turn=s.players.findIndex(p=>!p.eliminated);s.passes=0;s.round++;s.status="running";s.knockoutTally=undefined;s.message="The next knockout round is ready.";s.version++;s.moves=[...s.moves,{version:s.version,message:s.message}].slice(-30);return s;
}
export function practiceMove(state:PracticeState,actor:string,cardId?:string,suit?:PlayingSuit):PracticeState {
 if(state.status!=="running" || state.winner || state.players[state.turn]?.id!==actor)return state;
 const s=structuredClone(state);const idx=s.turn;const p=s.players[idx];
 if(cardId){
  const index=p.hand.findIndex(c=>c.id===cardId);if(index<0)return state;
  const c=p.hand[index];if(!practiceCanPlay(s,c))return state;
  if(c.suit==="whot" && s.rules.whotCallsSuit && p.hand.length>1 && !suit)return state;
  s.passes=0;p.hand.splice(index,1);s.discard.push(c);s.calledSuit=null;
  s.message=p.name+" played "+c.value+" "+SUIT_META[c.suit].short+".";
  if(!p.hand.length)finishRound(s,p.id,p.name+" emptied their hand.");
  else if(s.penalty){
   s.penalty=penaltyMode(s.penaltyType!,s.rules)==="block"?0:s.penalty+(c.value===5?3:2);if(!s.penalty)s.penaltyType=null;s.turn=nextSeat(s,idx);
  } else if(c.suit==="whot"){
   s.calledSuit=s.rules.whotCallsSuit?suit!:null;s.turn=nextSeat(s,idx);if(s.calledSuit)s.message+=" Wants "+SUIT_META[s.calledSuit].short+".";
  } else if(c.value===2 && s.rules.pickTwoEnabled || c.value===5 && s.rules.pickThreeEnabled){
   s.penalty=c.value===5?3:2;s.penaltyType=c.value as 2|5;s.turn=nextSeat(s,idx);
  } else if(actionEnabled(c.value,s.rules) && c.value===14){
   s.players.forEach((other,i)=>{if(i!==idx && !other.eliminated)take(s,i,1);});s.turn=idx;
  } else s.turn=actionEnabled(c.value,s.rules) && c.value===1 ? idx : nextSeat(s,idx,actionEnabled(c.value,s.rules) && c.value===8 ? 2:1);
 } else {
  const penalty=s.penalty;let drawn=take(s,idx,penalty||1);
  if(!penalty && s.rules.drawMode==="until-playable")while(drawn && !p.hand.some(c=>practiceCanPlay(s,c))){const n=take(s,idx,1);if(!n)break;drawn+=n;}
  s.penalty=0;s.penaltyType=null;s.message=p.name+" drew "+drawn+" card"+(drawn===1?"":"s")+".";
  s.passes=drawn===0?s.passes+1:0;
  const exhausted=s.passes>=s.players.filter(player=>!player.eliminated).length;
  if(exhausted)finishRound(s,null,"Market empty.");
  else s.turn=!penalty && s.rules.drawMode==="until-playable" && p.hand.some(c=>practiceCanPlay(s,c)) ? idx : nextSeat(s,idx);
 }
 s.version++;s.moves=[...s.moves,{version:s.version,message:s.message}].slice(-30);return s;
}
export function botChoice(s:PracticeState,difficulty:Difficulty){
 const hand=s.players[s.turn].hand;const playable=hand.filter(c=>practiceCanPlay(s,c));
 const ranked=difficulty==="easy"?shuffle(playable):[...playable].sort((a,b)=>{
  const rank=(c:Card)=>c.score+(difficulty==="hard" ? hand.filter(h=>h.suit===c.suit).length*3+(actionEnabled(c.value,s.rules)?8:0)-(c.suit==="whot" && hand.length>2?25:0):0);
  return rank(b)-rank(a);
 });
 const card=ranked[0];
 const suit=[...SUITS].sort((a,b)=>hand.filter(c=>c.id!==card?.id && c.suit===b).length-hand.filter(c=>c.id!==card?.id && c.suit===a).length)[0];
 return {cardId:card?.id,suit};
}
