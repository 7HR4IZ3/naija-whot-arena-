"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/screen-header';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useArena } from '@/lib/use-arena';
import { ArenaFeedback } from '@/components/arena-feedback';
import './online-game.css';
import type { User } from '@supabase/supabase-js';
import type { MatchHistory } from '@/lib/arena';

function matchHref(gameId: string, roomCode: string | null) {
 const params = new URLSearchParams({ match: gameId });
 if (roomCode) params.set('room', roomCode);
 return `/game?${params.toString()}`;
}

function matchDate(value: string) {
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function Account({ section = 'profile' }: { section?: 'history' | 'profile' }) {
 const router = useRouter(); const [name, setName] = useState(''); const [message, setMessage] = useState(''); const [saving,setSaving]=useState(false);
 const tab = section;
 const { data, error, loading } = useArena<MatchHistory>('history', 'scope', 'me');
 const activeMatches = [...(data?.active ?? [])].sort((a,b) => Number(b.my_turn) - Number(a.my_turn));
 const completedMatches = data?.completed ?? data?.history ?? [];
 useEffect(() => { if (!isSupabaseConfigured()) return; let active = true; const client = createClient(); void client.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => { if (data.user) { const { data: profile } = await client.from('profiles').select('display_name').eq('id', data.user.id).single(); if (active) setName(profile?.display_name || ''); } }); return () => { active=false; }; }, []);
 const save = async () => { setSaving(true); try { const client=createClient(); const {data}=await client.auth.getUser(); if(!data.user) throw new Error('Sign in first'); const {error}=await client.from('profiles').update({display_name:name.trim()}).eq('id',data.user.id); if(error) throw error; setMessage('Name saved. It will be used for new tables.'); } catch(e) {setMessage(e instanceof Error?e.message:'Unable to save');} finally {setSaving(false);} };
 const profilePanel = <div className="account-grid"><section className="panel lobby-panel"><h2>Your profile</h2><label htmlFor="profile-name">Display name</label><input className="form-input" id="profile-name" maxLength={40} value={name} onChange={e=>setName(e.target.value)} /><button className="button button-primary" disabled={saving || !name.trim()} onClick={save}>Save name</button><p role="status">{message}</p></section>
  <section className="panel lobby-panel"><h2>Community leaderboard</h2><p>Ranked by online match wins.</p>{data?.leaderboard.map((p,i)=><div className="account-history-row" key={`${p.display_name}-${i}`}><strong>{i+1}. {p.display_name}</strong><span>{p.wins} wins · {p.games} played</span></div>)}</section></div>;
 const historyPanel = <section className="panel lobby-panel account-history-panel"><div className="account-history-intro"><p className="screen-kicker">YOUR GAMES</p><h2>Match history</h2><p>Rejoin a live match or review a completed result.</p></div><div className="account-match-history">{data && data.active === undefined && <p role="status">Active match history needs a database update. Completed results are shown below.</p>}<div className="account-section-heading"><h3>Active matches</h3><span>{activeMatches.length}</span></div>{activeMatches.map(match=><div className={`account-match-row ${match.my_turn ? 'is-your-turn' : ''}`} key={match.game_id}><div className="account-match-copy"><div className="account-match-title"><strong>{match.room_name || (match.tournament_id ? 'Tournament match' : 'Online match')}</strong><span className="account-live-badge">Live</span></div><strong className={`account-turn-label ${match.my_turn ? 'is-mine' : ''}`}>{match.my_turn ? 'Your turn' : `${match.turn_name || 'Opponent'}’s turn`}</strong><small>Round {match.round} · {match.player_count} players · Updated {matchDate(match.updated_at)}</small></div><Link className="text-link" href={matchHref(match.game_id, match.room_code)}>Rejoin →</Link></div>)}{data && !error && data.active !== undefined && activeMatches.length===0 && <p className="account-empty-state">No active matches. Start or join a table to see it here.</p>}<div className="account-section-heading account-completed-heading"><h3>Completed matches</h3><span>{completedMatches.length}</span></div>{completedMatches.map(match=><div className="account-history-row" key={match.game_id}><span><strong>{match.won?'Won':'Played'} · {match.score} points</strong><small>{match.room_name || (match.tournament_id ? 'Tournament match' : 'Online match')} · {matchDate(match.created_at)}</small></span><Link className="text-link" href={matchHref(match.game_id, match.room_code)}>Result →</Link></div>)}{data && !error && completedMatches.length===0 && <p className="account-empty-state">Completed matches will appear here after your first online game.</p>}</div></section>;
 return <main className="page-wrap"><ScreenHeader title={tab === 'history' ? 'Your matches' : 'Your profile'} kicker="ACCOUNT" description={tab === 'history' ? 'Pick up where you left off.' : 'Manage your display name.'} action={<button className="button button-secondary" onClick={async () => { if(isSupabaseConfigured()) await createClient().auth.signOut(); router.push('/auth'); router.refresh(); }}>Sign out</button>} /><ArenaFeedback error={error} loading={loading} />
  <div>{tab==='history' ? historyPanel : profilePanel}</div>
 </main>;
}
