import { AuthForm } from "@/components/auth-form";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const nextPath = next?.startsWith('/') && !next.startsWith('//') ? next : '/account';
  return <AuthForm initialError={error ? 'That email link expired or could not be verified. Sign in with your password, or request a new reset email.' : ''} nextPath={nextPath} />;
}
