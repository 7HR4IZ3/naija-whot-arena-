"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CardFace } from '@/components/card-face';
import { ArenaFeedback } from '@/components/arena-feedback';
import { SUITS, SUIT_META } from '@/lib/cards';
import { canPlay, type Game } from '@/lib/arena';
import { useArena } from '@/lib/use-arena';
import './online-game.css';

function Modal({ title, children, close }: { title: string; children: React.ReactNode; close?: () => void }) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
 return <dialog className="arena-dialog" ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); close?.(); }}><h2>{title}</h2>{children}{close && <button className="button button-secondary" onClick={close}>Close</button>}</dialog>;
}

export function OnlineGame({ id, roomCode }: { id: string; roomCode?: string }) {
 const router = useRouter();
 const { data: game, error, loading, busy, mutate, refresh } = useArena<Game>('game', 'game', id);
 const [selected, setSelected] = useState<string | null>(null);
 const [picker, setPicker] = useState(false);
 const [leave, setLeave] = useState(false);
 const [help, setHelp] = useState(false);
 const [animating, setAnimating] = useState(false);
 const [seconds, setSeconds] = useState<number | null>(null);
 const [sound, setSound] = useState(false);
 const audio = useRef<AudioContext | null>(null);
 const root = useRef<HTMLDivElement>(null);
 const previous = useRef<Game | null>(null);
 const timeoutVersion = useRef<number | null>(null);
 const mutateRef = useRef(mutate);
 useEffect(() => { mutateRef.current = mutate; }, [mutate]);
 useEffect(() => {
  const timer = setTimeout(() => { try { setSound(localStorage.getItem('whot:sound:v1') === 'on'); } catch {} }, 0);
  return () => { clearTimeout(timer); void audio.current?.close(); };
 }, []);
 useEffect(() => {
  if (!game?.deadline || game.status !== 'running') return;
  const offset = Date.parse(game.serverTime) - Date.now();
  const tick = () => {
   const left = Math.max(0, Math.ceil((Date.parse(game.deadline!) - Date.now() - offset) / 1000));
   setSeconds(left);
   if (left === 0 && timeoutVersion.current !== game.version) {
    timeoutVersion.current = game.version;
    void mutateRef.current('timeout', { version: game.version });
   }
  };
  tick(); const timer = setInterval(tick, 500);
  return () => clearInterval(timer);
 }, [game]);
 useEffect(() => {
  if (!game) return;
  const old = previous.current;
  previous.current = game;
  if (!old || old.version === game.version || !root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) { const timer=setTimeout(()=>setAnimating(false),0); return()=>clearTimeout(timer); }
  const controller = new AbortController();
  const fly = async () => {
   setAnimating(true);
   const event = game.event;
   let from: HTMLElement | null = null;
   let to: HTMLElement | null = null;
   const nodes = Array.from(root.current!.querySelectorAll<HTMLElement>('[data-player]'));
   const actor = nodes.find(n => n.dataset.player === event.actor) || null;
   if (event.type === 'play') { from = actor; to = root.current!.querySelector('[data-discard]'); }
   else if (event.type === 'draw' || event.type === 'timeout') { from = root.current!.querySelector('[data-market]'); to = actor; }
   const flights = event.type === 'play' ? 1 : Math.min(event.count || 0, 8);
   if (from && to) for (let i = 0; i < flights; i++) {
    if (controller.signal.aborted) break;
    const a = from.getBoundingClientRect(); const b = to.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = event.card ? `/cards/classic/${event.card.suit}-${event.card.value}.svg` : '/cards/classic/back.svg';
    img.alt = ''; img.className = 'arena-flying-card'; img.style.left = `${a.left + a.width / 2 - 34}px`; img.style.top = `${a.top + a.height / 2 - 51}px`;
    document.body.append(img);
    const animation = img.animate([{ transform: 'translate(0,0) rotate(-8deg)', opacity: .85 }, { transform: `translate(${b.left + b.width / 2 - a.left - a.width / 2}px,${b.top + b.height / 2 - a.top - a.height / 2}px) rotate(0)`, opacity: 1 }], { duration: flights > 1 ? 150 : 420, easing: 'cubic-bezier(.2,.75,.25,1)' });
    controller.signal.addEventListener('abort', () => animation.cancel(), { once: true });
    try { await animation.finished; } catch {} finally { img.remove(); }
   }
   if (!controller.signal.aborted) {
    setAnimating(false);
    if (audio.current?.state === 'running' && sound) {
     const tone = audio.current.createOscillator(); const gain = audio.current.createGain();
     tone.connect(gain); gain.connect(audio.current.destination); gain.gain.setValueAtTime(.025, audio.current.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.current.currentTime + .09); tone.frequency.value = 420; tone.start(); tone.stop(audio.current.currentTime + .1);
    }
   }
  };
  void fly();
  return () => { controller.abort(); };
 }, [game, sound]);
 const me = game?.players.find(p => p.id === game.me);
 const turn = game?.players[game.turn];
 const myTurn = turn?.id === game?.me && game?.status === 'running' && !me?.eliminated;
 const locked = busy || animating || !myTurn;
 const card = game?.hand.find(c => c.id === selected);
 const exit = game?.tournamentId ? `/tournaments/${game.tournamentId}` : roomCode ? `/table/${roomCode}` : '/play';
 const play = async (suit?: string) => {
  if (!game || !card || locked) return;
  if (card.suit === 'whot' && game.rules.whotCallsSuit && !suit) { setPicker(true); return; }
  setPicker(false);
  if (await mutate('play', { version: game.version, card: card.id, suit })) setSelected(null);
 };
 return <main className="online-game" ref={root} aria-busy={busy || animating}>
  <header className="arena-game-header"><button className="button button-secondary" onClick={() => setLeave(true)}>Leave</button><span>whot arena <small>{roomCode || 'Online table'}</small></span><div><button className="arena-icon" aria-label={sound ? 'Mute sounds' : 'Enable sounds'} aria-pressed={sound} onClick={() => { const next = !sound; setSound(next); try { localStorage.setItem('whot:sound:v1', next ? 'on' : 'off'); } catch {} if (next) { audio.current ??= new AudioContext(); void audio.current.resume(); } }}>{sound ? '♪' : '♩'}</button><button className="arena-icon" aria-label="Table rules" onClick={() => setHelp(true)}>?</button></div></header>
  <ArenaFeedback error={error} loading={loading} />
  {error && <button className="button button-secondary" onClick={() => refresh()}>Reconnect</button>}
  {game && <><section className="arena-opponents" aria-label="Opponents">{game.players.filter(p => p.id !== game.me).map(p => <div className={`arena-opponent ${turn?.id === p.id ? 'has-turn' : ''}`} data-player={p.id} key={p.id}><p><strong>{p.name}</strong><small>{p.eliminated ? 'Eliminated' : `${p.count} card${p.count === 1 ? '' : 's'}`}</small></p><div className="arena-backs">{Array.from({ length: Math.min(p.count, 7) }, (_, i) => <Image key={i} src="/cards/classic/back.svg" alt="Face down card" width={40} height={60} unoptimized style={{ transform: `rotate(${(i - Math.min(p.count - 1, 6) / 2) * 5}deg)` }} />)}</div>{p.count > 7 && <small>+{p.count - 7}</small>}</div>)}</section>
  <section className="arena-felt"><div className="arena-turn" role="status">{game.status === 'finished' ? 'Match complete' : me?.eliminated ? 'Watching the remaining players' : myTurn ? 'Your turn' : `${turn?.name}’s turn`}{game.deadline && <span>{seconds ?? '…'}s</span>}</div>
   <div className="arena-piles"><div data-market><CardFace card={game.top} hidden size="lg" /><small>Market · {game.marketCount}</small></div><div data-discard><CardFace key={game.top.id} card={game.top} size="lg" /><small>Playing stack</small></div></div>
   {game.calledSuit && <p className="arena-call">Called symbol: <strong>{game.calledSuit}</strong></p>}{game.penalty > 0 && <p className="arena-penalty">Pick {game.penalty} · {game.penaltyType === 2 ? game.rules.pickTwoMode : game.rules.pickThreeMode} defence</p>}
   <p className="arena-message" aria-live="polite">{game.message}</p>
  </section>
  <section className="arena-your-hand" data-player={game.me}><div className="arena-hand-heading"><strong>Your hand <span>{game.hand.length}</span></strong><small>Round {game.round} · {me?.total || 0} points</small></div>
   <div className="arena-cards">{game.hand.map(c => <CardFace key={c.id} card={c} selected={selected === c.id} disabled={locked || !canPlay(game,c)} className={canPlay(game,c) ? 'can-play' : 'cannot-play'} onClick={() => setSelected(selected === c.id ? null : c.id)} />)}</div>
   <div className="arena-controls"><button className="button button-secondary" disabled={locked} onClick={() => mutate('draw', { version: game.version })}>{game.penalty ? `Pick ${game.penalty} cards` : 'Go to market'}</button><button className="button button-primary" disabled={locked || !card || !canPlay(game,card)} onClick={() => play()}>{busy || animating ? 'Moving…' : 'Play selected card'}</button></div>
   <p className="arena-hint">{myTurn ? 'Select a highlighted card, then play it.' : 'Your hand is private. Rejoining restores your seat.'}</p>
  </section>
  {picker && <Modal title="Call a symbol" close={() => setPicker(false)}><div className="arena-shape-picker">{SUITS.map((s,i) => <button key={s} className="button button-secondary" onClick={() => play(s)}><span>{['●','▲','✚','■','★'][i]}</span>{SUIT_META[s].short}</button>)}</div></Modal>}
  {game.status === 'finished' && <Modal title={game.winner === game.me ? 'You won!' : 'A good round.'}><div className={`arena-result ${game.winner === game.me ? 'is-winner' : ''}`}>{game.winner === game.me ? '★' : 'w.'}</div><p>{game.players.find(p => p.id === game.winner)?.name} won the match.</p><div className="roster">{game.players.map(p => <div className="roster-row" key={p.id}><strong>{p.name}</strong><span>{p.total} points</span></div>)}</div><Link className="button button-primary" href={exit}>{game.tournamentId ? 'Back to bracket' : 'Back to table'}</Link><Link className="text-link" href="/account">Match history →</Link></Modal>}
  {help && <Modal title="At this table" close={() => setHelp(false)}><ul><li>{game.rules.gameType} · {game.rules.initialHand}-card deal</li><li>Pick Two: {game.rules.pickTwoEnabled ? game.rules.pickTwoMode : 'disabled'}</li><li>Pick Three: {game.rules.pickThreeEnabled ? game.rules.pickThreeMode : 'disabled'}</li><li>Suspension: {game.rules.suspensionEnabled ? 'on' : 'off'}</li><li>{game.rules.drawMode === 'one' ? 'Draw one and pass' : 'Draw until playable, then play'}</li><li>Last-card announcements are automatic.</li><li>With an empty market, a blocked round goes to the lowest hand score.</li></ul><p>The turn timer continues while this panel is open.</p></Modal>}
  </>}
  {leave && <Modal title="Leave this match?" close={() => setLeave(false)}><p>You can return later to resume, or forfeit your seat now.</p><div className="button-row"><button className="button button-secondary" onClick={() => router.push(game?.tournamentId ? `/tournaments/${game.tournamentId}` : '/play')}>Return later</button><button className="button button-primary" disabled={busy} onClick={async () => { if (!game || game.status === 'finished' || await mutate('forfeit', { version: game.version })) router.push(exit); }}>Forfeit & leave</button></div></Modal>}
 </main>;
}
