"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CardFace } from "./card-face";
import { GameModal } from "./game-modal";
import { MatchExtras, RoundResults } from "./match-extras";
import { RoomSettingsPanel } from "./room-settings";
import { SavedRules } from "./saved-rules";
import { botChoice, dealPractice, practiceCanPlay, practiceMove, type Difficulty, type PracticeState } from "@/lib/practice-engine";
import { DEFAULT_ROOM_SETTINGS, validateRoomConfiguration } from "@/lib/rules";
import { SUITS, SUIT_META, type PlayingSuit } from "@/lib/cards";
import { useCardDrag } from "@/lib/use-card-drag";
import { useCardMotion } from "@/lib/use-card-motion";
import "./online-game.css";

export function PracticeGame(){
 const [game,setGame]=useState<PracticeState|null>(null);
 const [count,setCount]=useState(2);
 const [difficulty,setDifficulty]=useState<Difficulty>("standard");
 const [rules,setRules]=useState({...DEFAULT_ROOM_SETTINGS,turnTimer:"off" as const});
 const [selected,setSelected]=useState<string|null>(null);
 const [picker,setPicker]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const [dealId,setDealId]=useState(0);
 const root=useRef<HTMLElement>(null);
 const top=game?.discard[game.discard.length-1];
 const moving=useCardMotion(game && top ? {key:`practice-${dealId}-${game.round}`,top,players:game.players.map(p=>({id:p.id,count:p.hand.length,cards:p.hand}))}:null,root);
 const locked=!game || Boolean(game.winner) || game.turn!==0 || moving || Boolean(picker);
 const play=(id:string,suit?:PlayingSuit)=>{
  if(!game || moving || game.turn!==0 || game.winner)return;
  const card=game.players[0].hand.find(c=>c.id===id);
  if(!card || !practiceCanPlay(game,card)){setMessage("Match the number or requested symbol, or draw from the market.");return;}
  if(card.suit==="whot" && game.rules.whotCallsSuit && game.players[0].hand.length>1 && !suit){setPicker(id);return;}
  setGame(practiceMove(game,"0",id,suit));setSelected(null);setPicker(null);setMessage("");
 };
 const drag=useCardDrag({disabled:locked,onDrop:play});
 useEffect(()=>{
  if(!game || game.winner || game.turn===0 || moving)return;
  const timer=setTimeout(()=>setGame(current=>{if(!current || current.winner || current.turn===0)return current;const choice=botChoice(current,difficulty);return practiceMove(current,current.players[current.turn].id,choice.cardId,choice.suit);}),750);
  return ()=>clearTimeout(timer);
 },[game,moving,difficulty]);
 const start=()=>{const issue=validateRoomConfiguration(count,rules);if(issue){setMessage(issue);return;}setDealId(v=>v+1);setGame(dealPractice(count,rules));setSelected(null);setPicker(null);setMessage("");};
 if(!game || !top)return <main className="page-wrap"><header className="simple-heading"><h1>Practice</h1><p>Learn at your own pace. Bots only use their own cards and the public table.</p></header><section className="panel lobby-panel practice-options"><label htmlFor="practice-count">Players, including you</label><select className="form-select" id="practice-count" value={count} onChange={e=>setCount(Number(e.target.value))}>{[2,3,4].map(n=><option key={n} value={n}>{n} players</option>)}</select><label htmlFor="practice-difficulty">Difficulty</label><select className="form-select" id="practice-difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}><option value="easy">Easy · random playable cards</option><option value="standard">Standard · sheds high points</option><option value="hard">Hard · plans symbols and power cards</option></select><SavedRules settings={rules} players={count} onLoad={r=>setRules({...r,turnTimer:"off"})}/><RoomSettingsPanel settings={rules} maxPlayers={count} onChange={patch=>setRules(r=>({...r,...patch,turnTimer:"off"}))}/><p>Practice is always untimed.</p><p role="alert">{message}</p><button className="button button-primary" onClick={start}>Start practice</button><Link className="text-link" href="/tutorial">Learn how to play →</Link></section></main>;
 const hand=game.players[0].hand;
 const ghost=hand.find(c=>c.id===drag.draggingId);
 const draw=()=>{if(!locked){setGame(practiceMove(game,"0"));setSelected(null);}};
 const onlyMarket=!locked && !hand.some(c=>practiceCanPlay(game,c));
 return <main className="online-game" ref={root}><header className="arena-game-header"><Link className="button button-secondary" href="/">Leave</Link><span>Practice<small>{difficulty} · Untimed</small></span><button className="button button-secondary" onClick={()=>{setGame(null);setPicker(null);}}>Settings</button></header>
 <section className="arena-opponents" aria-label="Opponents">{game.players.slice(1).map((p,i)=><div className={`arena-opponent ${game.turn===i+1?"has-turn":""}`} key={p.id} data-player={p.id}><p><strong>{p.name}</strong><small>{p.eliminated?"Eliminated":p.hand.length+" cards"}</small></p><div className="arena-backs">{Array.from({length:Math.min(p.hand.length,7)},(_,n)=><Image key={n} alt="Face down card" draggable={false} src="/cards/classic/back.svg" width={36} height={54} unoptimized/>)}</div></div>)}</section>
 <section className="arena-felt"><div className="arena-turn" role="status">{game.winner?"Match complete":moving?"Cards moving…":game.turn===0?"Your turn":game.players[game.turn].name+"’s turn"}</div><div className="arena-piles"><div data-market className={onlyMarket?"arena-market-pile is-required":"arena-market-pile"}><button className="arena-market-button" aria-label="Draw from market" disabled={locked} onClick={draw}><CardFace card={top} hidden/></button><small>Market · {game.deck.length}</small></div><div data-discard data-drop-target className={`arena-drop-target ${drag.overTarget?"is-drop-target":""}`}><CardFace card={top}/><small>Playing stack</small></div></div>{game.calledSuit && <div className="arena-whot-want"><span className="arena-whot-want-label">{SUIT_META[game.calledSuit].short}</span></div>}<p className="arena-message" aria-live="polite">{message||game.message}</p>{game.penalty>0 && <p className="arena-penalty">Pick {game.penalty}, or defend with a {game.penaltyType}</p>}</section>
 <section data-player="0" className={`arena-your-hand ${game.turn===0 && !game.winner ? "is-your-turn":""}`}><div className="arena-hand-heading"><strong>Your hand · {hand.length}</strong><span className={`arena-turn-badge ${game.turn===0 && !game.winner?"is-active":""}`}>{game.players[0].eliminated?"Eliminated":game.turn===0 && !game.winner?"Your turn":"Waiting"}</span><small>Round {game.round} · {game.players[0].total} points</small></div><div className="arena-cards">{hand.map(c=><CardFace key={c.id} card={c} selected={selected===c.id} disabled={locked || !practiceCanPlay(game,c)} className={`${practiceCanPlay(game,c)?"can-play":"cannot-play"} ${drag.draggingId===c.id?"is-dragging":""}`} {...drag.getCardHandlers(c.id)} onClick={()=>{if(!drag.consumeClick())setSelected(selected===c.id?null:c.id);}}/>)}</div><div className="arena-controls"><button className="button button-secondary" disabled={locked} onClick={draw}>Go to market</button><button className="button button-primary" disabled={locked || !selected} onClick={()=>selected && play(selected)}>Play selected card</button></div><p className="arena-hint">Swipe sideways to see cards. Drag upward to the pot, or tap then play.</p></section>
 {ghost && drag.dragPosition && <div className="arena-drag-ghost" aria-hidden="true" style={{left:drag.dragPosition.x,top:drag.dragPosition.y}}><CardFace card={ghost}/></div>}
 <MatchExtras moves={game.moves} rounds={game.rounds}/>
 {picker && <GameModal title="Call a symbol" close={()=>setPicker(null)}><div className="arena-shape-picker">{SUITS.map(s=><button className="button button-secondary" key={s} onClick={()=>play(picker,s)}>{SUIT_META[s].short}</button>)}</div></GameModal>}
 {game.winner && !moving && <GameModal title={game.winner==="0"?"You won!":game.players.find(p=>p.id===game.winner)!.name+" won"}><p>{game.message}</p><RoundResults rounds={game.rounds}/><button className="button button-primary" onClick={start}>Rematch</button><button className="text-link" onClick={()=>setGame(null)}>Change practice settings</button></GameModal>}
 </main>;
}
