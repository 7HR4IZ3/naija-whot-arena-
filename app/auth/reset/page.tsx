import { AuthForm } from '@/components/auth-form';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
export default async function ResetPasswordPage() {
 if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) redirect('/auth');
 const client = await createServerSupabaseClient();
 const { data, error } = await client.auth.getUser();
 if (error || !data.user) redirect('/auth?error=expired');
 return <AuthForm initialMode="reset" />;
}
