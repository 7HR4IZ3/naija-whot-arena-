"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { arena } from '@/lib/arena';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

// One subscription per view; periodic snapshots repair missed or disconnected events.
export function useArena<T>(action: string, key: string, value: string) {
 const [data, setData] = useState<T | null>(null);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const active = useRef(false);
 const lock = useRef(false);
 const generation = useRef(0);
 const refresh = useCallback(async () => {
  const current = ++generation.current;
  try {
   const next = await arena<T>(action, { [key]: value });
   if (active.current && current === generation.current) { setData(next); setError(''); }
  } catch (e) { if (active.current && current === generation.current) setError(e instanceof Error ? e.message : 'Unable to connect.'); }
  finally { if (active.current) setLoading(false); }
 }, [action, key, value]);
 useEffect(() => {
  active.current = true;
  const initial = setTimeout(() => { void refresh(); }, 0);
  const timer = setInterval(() => { if (document.visibilityState === 'visible' && !lock.current) void refresh(); }, 5000);
  const resume = () => { if (!lock.current) void refresh(); };
  window.addEventListener('online', resume); window.addEventListener('focus', resume);
  const client = isSupabaseConfigured() ? createClient() : null;
  const channel = client?.channel(`arena-${action}-${value}`).on('postgres_changes', { event: '*', schema: 'public', table: 'arena_updates' }, resume).subscribe();
  return () => { active.current = false; clearTimeout(initial); clearInterval(timer); window.removeEventListener('online', resume); window.removeEventListener('focus', resume); if (channel && client) void client.removeChannel(channel); };
 }, [action, value, refresh]);
 const mutate = async (operation: string, input: Record<string, unknown> = {}) => {
  if (lock.current) return null;
  lock.current = true; setBusy(true); setError(''); generation.current++;
  try {
   const result = await arena<T>(operation, { [key]: value, ...input });
   await refresh(); return result;
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your action.'); return null; }
  finally { lock.current = false; if (active.current) setBusy(false); }
 };
 return { data, error, loading, busy, refresh, mutate };
}
