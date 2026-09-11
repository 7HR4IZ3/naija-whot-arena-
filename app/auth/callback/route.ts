import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
 const code = request.nextUrl.searchParams.get('code');
 if (code) {
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (!error) {
   const next = request.nextUrl.searchParams.get('next');
   const destination = next === 'reset' ? '/auth/reset' : next?.startsWith('/') && !next.startsWith('//') ? next : '/account';
   return NextResponse.redirect(new URL(destination, request.url));
  }
 }
 return NextResponse.redirect(new URL('/auth?error=expired', request.url));
}
