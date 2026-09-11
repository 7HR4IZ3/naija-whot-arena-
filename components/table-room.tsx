"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/screen-header';
import { RoomSettingsPanel } from '@/components/room-settings';
import { ArenaFeedback } from '@/components/arena-feedback';
import { useArena } from '@/lib/use-arena';
import type { Room } from '@/lib/arena';
import type { RoomSettings } from '@/lib/rules';
export function TableRoom({ code }: { code: string }) {
 const router = useRouter();
 const { data: room, error, loading, busy, mutate } = useArena<Room>('room', 'code', code.toUpperCase());
 const [copied, setCopied] = useState(false);
 const [draft, setDraft] = useState<RoomSettings | null>(null);
 const [leave, setLeave] = useState(false);
 useEffect(() => { if (room?.status === 'running' && room.game) router.replace(`/game?match=${room.game}&room=${code}`); }, [room, code, router]);
 const me = room?.players.find(p => p.id === room.me);
 const isHost = room?.host === room?.me;
 return <main className="page-wrap page-lobby">
  <ScreenHeader title={room?.name || 'Your table'} kicker={`ROOM / ${code.toUpperCase()}`} description="Get comfortable. The game starts when everyone is ready." action={<button className="button button-secondary" onClick={() => setLeave(true)}>Leave room</button>} />
  <ArenaFeedback error={error} loading={loading} />
  {room && <div className="lobby-grid"><section className="panel lobby-panel lobby-card">
   <div className="room-title-line"><h2>Players</h2><span>{room.players.length} / {room.maxPlayers}</span></div>
   <div className="code-strip"><span className="code">{room.code}</span><button className="text-link" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/lobby?code=${room.code}#join-table`); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Link copied' : 'Copy invite link'}</button></div>
   <div className="roster">{room.players.map(p => <div className="roster-row" key={p.id}><div className="roster-person"><span className="player-avatar">{p.name[0]}</span><span><strong>{p.name}{p.id === room.me ? ' · you' : ''}</strong><small className="player-meta">{p.id === room.host ? 'Host · ' : ''}{p.connected ? 'Here now' : 'Away'}</small></span></div><span className={p.ready ? 'ready' : 'waiting'}>{p.ready ? 'Ready' : 'Not ready'}</span></div>)}</div>
   <div className="button-row">{room.status === 'waiting' && <button className="button button-secondary" disabled={busy} onClick={() => mutate('ready', { ready: !me?.ready })}>{me?.ready ? 'Unready' : 'Ready up'}</button>}{isHost && room.status === 'waiting' && <button className="button button-primary" disabled={busy || room.players.length < 2 || room.players.some(p => !p.ready)} onClick={() => mutate('startRoom')}>Start game</button>}{isHost && room.status === 'finished' && <button className="button button-primary" disabled={busy} onClick={() => mutate('rematch')}>Open rematch lobby</button>}{room.game && room.status === 'finished' && <Link className="text-link" href={`/game?match=${room.game}&room=${code}`}>Last result</Link>}</div>
   <p className="form-helper">Every player must be ready. Changing rules resets everyone’s ready state.</p>
  </section><aside className="panel rules-panel"><h3>House rules</h3>{isHost && room.status === 'waiting' ? <><RoomSettingsPanel idPrefix="waiting" settings={draft || room.rules} onChange={patch => setDraft({ ...(draft || room.rules), ...patch })} />{draft && <button className="button button-primary" disabled={busy} onClick={async () => { if (await mutate('settings', { rules: draft })) setDraft(null); }}>Save rules</button>}</> : <ul><li>{room.rules.gameType} · {room.rules.initialHand} cards</li><li>Pick Two: {room.rules.pickTwoEnabled ? room.rules.pickTwoMode : 'off'}</li><li>Pick Three: {room.rules.pickThreeEnabled ? room.rules.pickThreeMode : 'off'}</li><li>Suspension: {room.rules.suspensionEnabled ? 'on' : 'off'}</li><li>Timer: {room.rules.turnTimer === 'off' ? 'off' : `${room.rules.turnTimer}s`}</li></ul>}</aside></div>}
  {leave && <div className="alert"><p>Leave this table? If you host, the next player becomes host.</p><div className="button-row"><button className="button button-secondary" onClick={() => setLeave(false)}>Stay</button><button className="button button-primary" disabled={busy} onClick={async () => { if (!room || await mutate('leaveRoom')) router.push('/play'); }}>Leave table</button></div></div>}
 </main>;
}
