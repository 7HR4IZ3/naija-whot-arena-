"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CardFace } from '@/components/card-face';
import { ArenaFeedback } from '@/components/arena-feedback';
import { SUITS, SUIT_META, type PlayingSuit } from '@/lib/cards';
import { canPlay, type Game } from '@/lib/arena';
import { emptyMarketDescription, gameTypeLabel } from '@/lib/rules';
import { useArena } from '@/lib/use-arena';
import { useCardMotion } from '@/lib/use-card-motion';
import './online-game.css';
import { GameModal as Modal } from '@/components/game-modal';

const SUIT_SYMBOLS: Record<PlayingSuit, string> = { circle: '●', triangle: '▲', cross: '✚', square: '■', star: '★' };

export function OnlineGame({ id, roomCode }: { id: string; roomCode?: string }) {
 const router = useRouter();
 const { data: game, error, loading, busy, mutate, refresh } = useArena<Game>('game', 'game', id);
 const [selected, setSelected] = useState<string | null>(null);
 const [picker, setPicker] = useState(false);
 const [leave, setLeave] = useState(false);
 const [help, setHelp] = useState(false);
 const [dismissedTenderVersion, setDismissedTenderVersion] = useState<number | null>(null);
 const [seconds, setSeconds] = useState<number | null>(null);
 const [sound, setSound] = useState(false);
 const audio = useRef<AudioContext | null>(null);
 const root = useRef<HTMLDivElement>(null);
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
 const animating = useCardMotion(game ? { key: game.id + ':' + game.round, top: game.top, actor: game.event.actor, players: game.players.map(p => ({ id: p.id, count: p.count })) } : null, root);
 useEffect(() => {
  if (!sound || audio.current?.state !== 'running') return;
  const context = audio.current;
  const tone = context.createOscillator(); const gain = context.createGain();
  tone.connect(gain); gain.connect(context.destination);
  gain.gain.setValueAtTime(.02, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .09);
  tone.frequency.value = 420; tone.start(); tone.stop(context.currentTime + .1);
 }, [game?.version, sound]);
 const me = game?.players.find(p => p.id === game.me);
 const turn = game?.players[game.turn];
 const myTurn = turn?.id === game?.me && game?.status === 'running' && !me?.eliminated;
 const locked = busy || animating || !myTurn;
 const marketOnlyOption = Boolean(game && !locked && game.hand.every(cardInHand => !canPlay(game, cardInHand)));
 const card = game?.hand.find(c => c.id === selected);
 const wantedSuit = game?.calledSuit && SUITS.includes(game.calledSuit as PlayingSuit) ? game.calledSuit as PlayingSuit : null;
 const tenderNotice = game?.rules.gameType === 'tender' && game.event.type === 'tender-elimination' && dismissedTenderVersion !== game.version;
 const marketRule = game?.rules.emptyMarketMode === 'recycle'
  ? emptyMarketDescription('recycle')
  : game?.rules.gameType === 'tender'
   ? 'When the market is exhausted, count active hands and eliminate the lowest total.'
   : 'When the market is blocked, count hand points; the highest total loses.';
 const exit = game?.tournamentId ? `/tournaments/${game.tournamentId}` : roomCode ? `/table/${roomCode}` : '/play';
 const play = async (suit?: string) => {
  if (!game || !card || locked) return;
  if (card.suit === 'whot' && game.rules.whotCallsSuit && !suit) { setPicker(true); return; }
  setPicker(false);
  if (await mutate('play', { version: game.version, card: card.id, suit })) setSelected(null);
 };
 const draw = () => { if (!game || locked) return; void mutate('draw', { version: game.version }); };
 return <main className="online-game" ref={root} aria-busy={busy || animating}>
  <header className="arena-game-header"><button className="button button-secondary" onClick={() => setLeave(true)}>Leave</button><span>whot arena <small>{roomCode || 'Online table'}</small></span><div><button className="arena-icon" aria-label={sound ? 'Mute sounds' : 'Enable sounds'} aria-pressed={sound} onClick={() => { const next = !sound; setSound(next); try { localStorage.setItem('whot:sound:v1', next ? 'on' : 'off'); } catch {} if (next) { audio.current ??= new AudioContext(); void audio.current.resume(); } }}>{sound ? '♪' : '♩'}</button><button className="arena-icon" aria-label="Table rules" onClick={() => setHelp(true)}>?</button></div></header>
  <ArenaFeedback error={error} loading={loading} />
  {error && <button className="button button-secondary" onClick={() => refresh()}>Reconnect</button>}
  {game && <><section className="arena-opponents" aria-label="Opponents">{game.players.filter(p => p.id !== game.me).map(p => <div className={`arena-opponent ${turn?.id === p.id ? 'has-turn' : ''}`} data-player={p.id} key={p.id}><p><strong>{p.name}</strong><small>{p.eliminated ? 'Eliminated' : `${p.count} card${p.count === 1 ? '' : 's'}`}</small></p><div className="arena-backs">{Array.from({ length: Math.min(p.count, 7) }, (_, i) => <Image key={i} src="/cards/classic/back.svg" alt="Face down card" width={40} height={60} unoptimized style={{ transform: `rotate(${(i - Math.min(p.count - 1, 6) / 2) * 5}deg)` }} />)}</div>{p.count > 7 && <small>+{p.count - 7}</small>}</div>)}</section>
  <section className="arena-felt"><div className="arena-turn" role="status">{game.status === 'finished' ? 'Match complete' : me?.eliminated ? 'Watching the remaining players' : myTurn ? 'Your turn' : `${turn?.name}’s turn`}{game.deadline && <span>{seconds ?? '…'}s</span>}</div>
   <div className="arena-piles"><div className={marketOnlyOption ? 'arena-market-pile is-required' : 'arena-market-pile'} data-market><button type="button" className="arena-market-button" aria-label={game.marketCount ? 'Draw from market' : 'Resolve the empty market'} disabled={locked} onClick={draw}><CardFace card={game.top} hidden size="lg" /></button><small>Market · {game.marketCount}</small></div><div data-discard><CardFace key={game.top.id} card={game.top} size="lg" /><small>Playing stack</small></div></div>
   {wantedSuit && <div className="arena-whot-want" role="status" aria-label={`Whot wants ${SUIT_META[wantedSuit].short}. Play that symbol or another Whot.`} style={{ borderColor: SUIT_META[wantedSuit].color }}><span aria-hidden="true" className="arena-whot-want-symbol" style={{ color: SUIT_META[wantedSuit].color }}>{SUIT_SYMBOLS[wantedSuit]}</span><span className="arena-whot-want-label">{SUIT_META[wantedSuit].short}</span></div>}{game.penalty > 0 && <p className="arena-penalty">Pick {game.penalty} · {game.penaltyType === 2 ? game.rules.pickTwoMode : game.rules.pickThreeMode} defence</p>}
   <p className="arena-message" aria-live="polite">{game.message}</p>
  </section>
  <section className={`arena-your-hand ${myTurn ? 'is-your-turn' : ''}`} data-player={game.me}><div className="arena-hand-heading"><strong>Your hand <span>{game.hand.length}</span></strong><span className={`arena-turn-badge ${myTurn ? 'is-active' : ''}`}>{myTurn ? 'Your turn' : 'Waiting'}</span><small>Round {game.round} · {me?.total || 0} points</small></div>
   <div className="arena-cards">{game.hand.map(c => <CardFace key={c.id} card={c} selected={selected === c.id} disabled={locked || !canPlay(game,c)} className={canPlay(game,c) ? 'can-play' : 'cannot-play'} onClick={() => setSelected(selected === c.id ? null : c.id)} />)}</div>
   <div className="arena-controls"><button className="button button-secondary" disabled={locked} onClick={draw}>{game.penalty ? `Pick ${game.penalty} cards` : 'Go to market'}</button><button className="button button-primary" disabled={locked || !card || !canPlay(game,card)} onClick={() => play()}>{busy || animating ? 'Moving…' : card ? `Play ${card.value} ${SUIT_META[card.suit].short}` : 'Select a card'}</button></div>
   <p className="arena-hint">{myTurn ? 'Select a highlighted card, then play it.' : 'Your hand is private. Rejoining restores your seat.'}</p>
  </section>
  {picker && <Modal title="Call a symbol" close={() => setPicker(false)}><div className="arena-shape-picker">{SUITS.map((s,i) => <button key={s} className="button button-secondary" onClick={() => play(s)}><span>{['●','▲','✚','■','★'][i]}</span>{SUIT_META[s].short}</button>)}</div></Modal>}
  {game.status === 'finished' && <Modal title={game.winner === game.me ? 'You won!' : 'Match result'}><div className={`arena-result ${game.winner === game.me ? 'is-winner' : ''}`}>{game.winner === game.me ? '★' : 'w.'}</div><p>{game.players.find(p => p.id === game.winner)?.name} won the match.</p><p>{game.message}</p><div className="roster">{game.players.map(p => <div className="roster-row" key={p.id}><strong>{p.name}</strong><span>{p.total} points</span></div>)}</div><Link className="button button-primary" href={exit}>{game.tournamentId ? 'Back to bracket' : 'Back to table'}</Link><Link className="text-link" href="/history">Match history →</Link></Modal>}
  {tenderNotice && <Modal title="Tender tally" close={() => setDismissedTenderVersion(game.version)}><p className="arena-tender-intro">The market finished. Every active hand was counted.</p><div className="arena-tender-tally">{(game.tenderTally || []).map(player => <div className={`arena-tender-row ${player.eliminated ? 'is-eliminated' : ''}`} key={player.id}><span><strong>{player.name}</strong><small>{player.eliminated ? 'Eliminated' : 'Still in'}</small></span><b>{player.score}</b></div>)}</div><p className="arena-tender-result">{game.message}</p><button className="button button-primary" onClick={() => setDismissedTenderVersion(game.version)}>Continue</button></Modal>}
  {help && <Modal title="At this table" close={() => setHelp(false)}><ul><li>{gameTypeLabel(game.rules.gameType, game.rules.targetScore)} · {game.rules.initialHand}-card deal</li><li>Pick Two: {game.rules.pickTwoEnabled ? game.rules.pickTwoMode : 'disabled'}</li><li>Pick Three: {game.rules.pickThreeEnabled ? game.rules.pickThreeMode : 'disabled'}</li><li>Suspension: {game.rules.suspensionEnabled ? 'on' : 'off'}</li><li>{game.rules.drawMode === 'one' ? 'Draw one and pass' : 'Draw until playable, then play'}</li><li>Last-card announcements are automatic.</li><li>{marketRule}</li></ul><p>The turn timer continues while this panel is open.</p></Modal>}
  </>}
  {leave && <Modal title="Leave this match?" close={() => setLeave(false)}><p>You can return later to resume, or forfeit your seat now.</p><div className="button-row"><button className="button button-secondary" onClick={() => router.push(game?.tournamentId ? `/tournaments/${game.tournamentId}` : '/play')}>Return later</button><button className="button button-primary" disabled={busy} onClick={async () => { if (!game || game.status === 'finished' || await mutate('forfeit', { version: game.version })) router.push(exit); }}>Forfeit & leave</button></div></Modal>}
 </main>;
}
