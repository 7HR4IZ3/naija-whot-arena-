import { AuthForm } from "@/components/auth-form";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthForm initialError={error ? 'That email link expired or could not be verified. Sign in with your password, or request a new reset email.' : ''} />;
}
