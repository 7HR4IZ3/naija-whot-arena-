"use client";
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { createClient,isSupabaseConfigured } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
export function AccountLink(){const [signed,setSigned]=useState(false);useEffect(()=>{if(!isSupabaseConfigured())return;const client=createClient();const {data}=client.auth.onAuthStateChange((_event: AuthChangeEvent,session: Session | null)=>setSigned(Boolean(session)));return()=>data.subscription.unsubscribe();},[]);return <Link className="account-link" href={signed?'/account':'/auth'}>{signed?'Account':'Sign in'} ↗</Link>;}
