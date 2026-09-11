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
type History = { history: { game_id: string; score: number; won: boolean; created_at: string }[]; leaderboard: { display_name: string; games: number; wins: number }[] };
export function Account() {
 const router = useRouter(); const [name, setName] = useState(''); const [message, setMessage] = useState(''); const [saving,setSaving]=useState(false);
 const { data, error, loading } = useArena<History>('history', 'scope', 'me');
 useEffect(() => { if (!isSupabaseConfigured()) return; let active = true; const client = createClient(); void client.auth.getUser().then(async ({ data }: { data: { user: User | null } }) => { if (data.user) { const { data: profile } = await client.from('profiles').select('display_name').eq('id', data.user.id).single(); if (active) setName(profile?.display_name || ''); } }); return () => { active=false; }; }, []);
 const save = async () => { setSaving(true); try { const client=createClient(); const {data}=await client.auth.getUser(); if(!data.user) throw new Error('Sign in first'); const {error}=await client.from('profiles').update({display_name:name.trim()}).eq('id',data.user.id); if(error) throw error; setMessage('Name saved. It will be used for new tables.'); } catch(e) {setMessage(e instanceof Error?e.message:'Unable to save');} finally {setSaving(false);} };
 return <main className="page-wrap"><ScreenHeader title="Your corner of the arena." kicker="ACCOUNT" description="Your name, your rounds, your progress." action={<button className="button button-secondary" onClick={async () => { if(isSupabaseConfigured()) await createClient().auth.signOut(); router.push('/auth'); router.refresh(); }}>Sign out</button>} /><ArenaFeedback error={error} loading={loading} />
  <div className="account-grid"><section className="panel lobby-panel"><h2>Your profile</h2><label htmlFor="profile-name">Display name</label><input className="form-input" id="profile-name" maxLength={40} value={name} onChange={e=>setName(e.target.value)} /><button className="button button-primary" disabled={saving || !name.trim()} onClick={save}>Save name</button><p role="status">{message}</p><h2>Recent matches</h2>{data?.history.map(h=><div className="account-history-row" key={h.game_id}><span><strong>{h.won?'Won':'Played'} · {h.score} points</strong><small>{new Date(h.created_at).toLocaleString()}</small></span><Link className="text-link" href={`/game?match=${h.game_id}`}>Result →</Link></div>)}{data?.history.length===0 && <p>Play your first online round to start your history.</p>}</section>
  <section className="panel lobby-panel"><h2>Community leaderboard</h2><p>Ranked by online match wins.</p>{data?.leaderboard.map((p,i)=><div className="account-history-row" key={`${p.display_name}-${i}`}><strong>{i+1}. {p.display_name}</strong><span>{p.wins} wins · {p.games} played</span></div>)}</section></div>
 </main>;
}
