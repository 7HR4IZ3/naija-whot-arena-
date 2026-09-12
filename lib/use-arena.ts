"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { arena } from '@/lib/arena';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export function useArena<T>(action: string, key: string, value: string) {
 const [data, setData] = useState<T | null>(null);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting');
 const active = useRef(false);
 const lock = useRef(false);
 const generation = useRef(0);
 const reading = useRef(false);
 const refresh = useCallback(async () => {
  if (reading.current || lock.current) return;
  if (!navigator.onLine) { setConnection('offline'); setLoading(false); return; }
  reading.current = true;
  const current = ++generation.current;
  try {
   const next = await arena<T>(action, { [key]: value });
   if (active.current && current === generation.current) { setData(next); setError(''); setConnection('connected'); }
  } catch (e) {
   if (active.current && current === generation.current) { setError(e instanceof Error ? e.message : 'Unable to connect.'); setConnection(navigator.onLine ? 'reconnecting' : 'offline'); }
  } finally {
   reading.current = false;
   if (active.current && current === generation.current) setLoading(false);
  }
 }, [action, key, value]);
 useEffect(() => {
  active.current = true;
  const requestGeneration=generation;
  const initial = setTimeout(() => { setData(null); setLoading(true); void refresh(); }, 0);
  const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
  const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
  const offline = () => setConnection('offline');
  window.addEventListener('online', resume); window.addEventListener('offline', offline); window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', resume);
  const client = isSupabaseConfigured() ? createClient() : null;
  const channel = client?.channel(`arena-${action}-${value}`).on('postgres_changes', { event: '*', schema: 'public', table: 'arena_updates' }, resume).subscribe();
  return () => {
   active.current = false; requestGeneration.current++; clearTimeout(initial); clearInterval(timer);
   window.removeEventListener('online', resume); window.removeEventListener('offline', offline); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume);
   if (channel && client) void client.removeChannel(channel);
  };
 }, [action, value, refresh]);
 const mutate = async (operation: string, input: Record<string, unknown> = {}) => {
  if (lock.current || connection !== 'connected' || !navigator.onLine) return null;
  lock.current = true; setBusy(true); setError(''); generation.current++;
  let result: T | null = null;
  let failure = '';
  try { result = await arena<T>(operation, { [key]: value, ...input }); }
  catch (e) { failure = e instanceof Error ? e.message : 'Could not confirm your action.'; }
  finally {
   // An uncertain write is never replayed. Read authoritative state before another move.
   const current=++generation.current;
   try {const next=await arena<T>(action,{[key]:value});if(active.current && generation.current===current){setData(next);setConnection('connected');setLoading(false);}}
   catch {if(active.current)setConnection(navigator.onLine?'reconnecting':'offline');}
   lock.current = false;
   if (active.current) { setBusy(false); if (failure) setError(failure); }
  }
  return result;
 };
 return { data, error, loading, busy, connection, refresh, mutate };
}
