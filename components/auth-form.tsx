"use client";

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader } from '@/components/screen-header';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import './auth-form.css';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'magic';

export function AuthForm({ initialMode = 'signin', initialError = '', nextPath = '/account' }: { initialMode?: Mode; initialError?: string; nextPath?: string }) {
 const router = useRouter();
 const [mode, setMode] = useState<Mode>(initialMode);
 const [email, setEmail] = useState('');
 const [name, setName] = useState('');
 const [password, setPassword] = useState('');
 const [confirmation, setConfirmation] = useState('');
 const [visible, setVisible] = useState(false);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 const [error, setError] = useState(initialError);
 const lock = useRef(false);
 const configured = isSupabaseConfigured();
 const destination = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/account';
 const title = { signin: 'Welcome back.', signup: 'Take your seat.', forgot: 'Forgot your password?', reset: 'Choose a new password.', magic: 'Sign in with a link.' }[mode];
 const switchMode = (next: Mode) => { setMode(next); setPassword(''); setConfirmation(''); setVisible(false); setError(''); setMessage(''); };
 const submit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (lock.current) return;
  setError(''); setMessage('');
  if ((mode === 'signup' || mode === 'reset') && password !== confirmation) { setError('Your passwords don’t match.'); return; }
  if (mode === 'signup' && !name.trim()) { setError('Enter your display name.'); return; }
  lock.current = true; setBusy(true);
  try {
   const client = createClient();
   if (mode === 'signin') {
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    setPassword(''); router.replace(destination); router.refresh();
   } else if (mode === 'signup') {
    const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(destination)}` } });
    if (error) throw error;
    setPassword(''); setConfirmation('');
    if (data.session) { router.replace(destination); router.refresh(); }
    else { setMode('signin'); setMessage('Check your email to confirm your account, then sign in with your password. If you already have an account, sign in or reset your password.'); }
   } else if (mode === 'magic') {
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(destination)}` } });
    if (error) throw error;
    setMessage('Check your inbox for your sign-in link. Open it in this browser.');
   } else if (mode === 'forgot') {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=reset` });
    if (error) throw error;
    setMessage('If an account exists for this email, you’ll receive a password-reset email. Open it in this browser.');
   } else {
    const { data: user, error: sessionError } = await client.auth.getUser();
    if (sessionError || !user.user) throw new Error('Your reset session expired. Request a new password-reset email.');
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    setPassword(''); setConfirmation('');
    router.replace(destination); router.refresh();
   }
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect. Please try again.'); }
  finally { lock.current = false; setBusy(false); }
 };
 return <main className="page-wrap page-auth">
  <ScreenHeader title={mode === 'signup' ? 'Create account' : 'Sign in'} kicker="YOUR ACCOUNT" description="Keep your matches and play with friends." action={<Link className="button button-secondary" href="/">Back home</Link>} />
  <div className="auth-layout"><section className="panel auth-card">
   {mode !== 'reset' && <div className="auth-mode-switch" aria-label="Account options"><button type="button" aria-pressed={mode === 'signin'} disabled={busy} onClick={() => switchMode('signin')}>Sign in</button><button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => switchMode('signup')}>Create account</button></div>}
   <h2>{title}</h2>
   {!configured ? <p>Account sign-in is not connected yet. <Link className="text-link" href="/game">Play a practice round →</Link></p> : <form className="password-auth-form" onSubmit={submit}>
    <fieldset disabled={busy}>
     {mode === 'signup' && <div className="auth-field"><label htmlFor="auth-name">Display name</label><input id="auth-name" className="form-input" autoComplete="nickname" maxLength={40} required value={name} onChange={e => setName(e.target.value)} /></div>}
     {mode !== 'reset' && <div className="auth-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" className="form-input" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={e => setEmail(e.target.value)} /></div>}
     {mode !== 'forgot' && mode !== 'magic' && <div className="auth-field"><label htmlFor="auth-password">{mode === 'reset' ? 'New password' : 'Password'}</label><div className="auth-password-input"><input id="auth-password" className="form-input" type={visible ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signin' ? undefined : 8} required value={password} onChange={e => setPassword(e.target.value)} aria-describedby={mode !== 'signin' ? 'password-help' : undefined} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div>{mode !== 'signin' && <small id="password-help">Use at least 8 characters.</small>}</div>}
     {(mode === 'signup' || mode === 'reset') && <div className="auth-field"><label htmlFor="auth-confirm">Confirm password</label><input id="auth-confirm" className="form-input" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>}
     {mode === 'signin' && <button className="text-link auth-forgot" type="button" onClick={() => switchMode('forgot')}>Forgot password?</button>}
     <button className="button button-primary auth-submit" type="submit">{busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset email', reset: 'Save new password', magic: 'Send magic link' }[mode]}</button>
     {mode === 'signin' && <button type="button" className="text-link auth-alternative" onClick={() => switchMode('magic')}>Email me a sign-in link</button>}
     {mode === 'magic' && <button type="button" className="text-link auth-alternative" onClick={() => switchMode('signin')}>Use my password instead</button>}
    </fieldset>
   </form>}
   {message && <div className="alert success" role="status">{message}</div>}{error && <div className="alert" role="alert">{error}</div>}
   {mode === 'reset' && <Link className="text-link" href="/auth">Back to sign in</Link>}
  </section><aside className="panel mini-note auth-note"><p className="screen-kicker">Keep your seat</p><p>Sign in with your email and password to join friends, enter tournaments, and keep your match history.</p><Link className="text-link" href="/game">Just practising? Play as a guest →</Link></aside></div>
 </main>;
}
