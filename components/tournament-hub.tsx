"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/screen-header';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { ArenaFeedback } from '@/components/arena-feedback';
type Event = { id: string; name: string; status: string; starts_at: string; max_players: number };
export function TournamentHub() {
 const [events, setEvents] = useState<Event[]>([]); const [filter, setFilter] = useState('registration'); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
 useEffect(() => {
  let active = true;
  const load = async () => {
   if (!isSupabaseConfigured()) { if (active) { setError('Online events are not connected yet.'); setLoading(false); } return; }
   const { data, error } = await createClient().from('tournaments').select('id,name,status,starts_at,max_players').order('created_at', { ascending: false }).limit(100);
   if (active) { setEvents(data || []); setError(error?.message || ''); setLoading(false); }
  };
  void load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 15000);
  return () => { active = false; clearInterval(timer); };
 }, []);
 return <main className="page-wrap page-events"><ScreenHeader title="Around the arena." kicker="TOURNAMENTS" description="A friendly rivalry, one round at a time." action={<Link className="button button-primary" href="/tournaments/new">Create tournament</Link>} /><ArenaFeedback error={error} loading={loading} /><section className="panel events-panel"><div className="button-row">{['registration','running','finished'].map(f => <button className="button button-secondary" aria-pressed={filter === f} key={f} onClick={() => setFilter(f)}>{f === 'registration' ? 'Open' : f === 'running' ? 'Live' : 'Finished'}</button>)}</div><div className="event-list">{events.filter(e => e.status === filter).map(e => <article className="event-row" key={e.id}><div className="event-copy"><h2>{e.name}</h2><p>{new Date(e.starts_at).toLocaleString()} · Up to {e.max_players} players</p></div><Link className="button button-secondary" href={`/tournaments/${e.id}`}>View event →</Link></article>)}{!loading && !events.some(e => e.status === filter) && <p className="empty-state">No events here yet. Create one and invite your people.</p>}</div></section></main>;
}
