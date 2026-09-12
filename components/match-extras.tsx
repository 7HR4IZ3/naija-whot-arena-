"use client";
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/cards";
import { SUIT_META } from "@/lib/cards";

export type RoundResult = { round: number; reason: string; mode: string; winner: string | null; players: { id: string; name: string; score: number; cards: Card[] }[] };
export function RoundResults({ rounds = [] }: { rounds?: RoundResult[] }) {
 return <details className="match-details"><summary>Round scorecards ({rounds.length})</summary>{rounds.length ? rounds.map(round => <section key={round.round}><h3>Round {round.round}</h3><p>{round.reason}</p>{round.players.map(player => <div className="scorecard-player" key={player.id}><strong>{player.name} · {player.score} points{round.winner === player.id ? " · Winner" : ""}</strong><p>{player.cards.length ? player.cards.map(c => `${c.value} ${SUIT_META[c.suit].short}`).join(", ") : "Empty hand"}</p></div>)}</section>) : <p>Scorecards appear after a round finishes.</p>}</details>;
}

export function TurnAlerts({ myTurn, matchId }: { myTurn: boolean; matchId: string }) {
 const [enabled, setEnabled] = useState(false);
 const [message, setMessage] = useState("");
 const previous = useRef<boolean | null>(null);
 useEffect(() => {
  if (enabled && myTurn && previous.current === false && document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
   try {
   const notification = new Notification("Your turn · Whot Arena", { body: "Your table is waiting for your move.", tag: `whot-${matchId}` });
   notification.onclick = () => { window.focus(); notification.close(); };
   } catch { /* Some mobile browsers expose permission APIs without desktop notifications. */ }
  }
  previous.current = myTurn;
 }, [enabled, myTurn, matchId]);
 const toggle = async () => {
  if (enabled) { setEnabled(false); setMessage(""); return; }
  if (!("Notification" in window)) { setMessage("This browser does not support turn alerts. Keep the game visible."); return; }
  try {
   const permission = await Notification.requestPermission();
   setEnabled(permission === "granted");
   setMessage(permission === "granted" ? "Alerts are on while this game tab stays open." : "Notifications are blocked. You can allow them in browser settings.");
  } catch { setMessage("Turn alerts are unavailable in this browser."); }
 };
 return <div className="match-alerts"><button className="text-link" type="button" aria-pressed={enabled} onClick={toggle}>{enabled ? "Turn alerts on" : "Enable turn alerts"}</button>{message && <small role="status">{message}</small>}</div>;
}

export function MatchExtras({ moves, rounds, reactions, onReact, busy }: {
 moves?: { version: number; message: string }[];
 rounds?: RoundResult[];
 reactions?: { id: string; name: string; message: string }[];
 onReact?: (message: string) => Promise<unknown>;
 busy?: boolean;
}) {
 const [muted,setMuted] = useState(false);
 const [cooldown,setCooldown] = useState(false);
 useEffect(() => { if (!cooldown) return; const timer=setTimeout(()=>setCooldown(false),5000); return ()=>clearTimeout(timer); },[cooldown]);
 return <div className="match-extras"><details className="match-details"><summary>Recent moves</summary>{moves?.length ? <ol>{moves.map(move=><li key={move.version}>{move.message}</li>)}</ol> : <p>No recorded moves yet.</p>}</details><RoundResults rounds={rounds}/>
 {onReact && <details className="match-details"><summary>Table reactions</summary><button type="button" className="text-link" aria-pressed={muted} onClick={()=>setMuted(!muted)}>{muted ? "Unmute reactions" : "Mute reactions"}</button>{!muted && <><div className="reaction-buttons">{["Nice move!","Good game!","Well played!","Thinking…"].map(message=><button type="button" className="button button-secondary" key={message} disabled={busy || cooldown} onClick={()=>{setCooldown(true); void onReact(message);}}>{message}</button>)}</div><div aria-live="polite">{reactions?.map(r=><p key={r.id}><strong>{r.name}</strong> · {r.message}</p>)}</div></>}</details>}
 </div>;
}
