import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
 const code = request.nextUrl.searchParams.get('code');
 if (code) {
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (!error) return NextResponse.redirect(new URL(request.nextUrl.searchParams.get('next') === 'reset' ? '/auth/reset' : '/account', request.url));
 }
 return NextResponse.redirect(new URL('/auth?error=expired', request.url));
}
