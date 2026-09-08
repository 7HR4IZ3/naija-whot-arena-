"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else setMessage("Magic link sent. Check your inbox to finish signing in.");
  };

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <Link href="/" className="button button-quiet"><ArrowLeft size={14} /> Back home</Link>
        <span className="eyebrow" style={{ marginTop: 25 }}>Your table, wherever you are</span>
        <h1>Sign in<br /><span style={{ color: "var(--pink)" }}>to stay in.</span></h1>
        <p>Sign in to create synced rooms, join tournaments, and keep your table identity across devices.</p>
        {!configured ? (
          <div className="rules-callout" style={{ marginTop: 25 }}><strong>Demo mode is active.</strong> Add your Supabase URL and anon key to enable magic-link auth and realtime lobbies. You can still play the local match now.</div>
        ) : (
          <form onSubmit={signIn}>
            <label className="sr-only" htmlFor="auth-email">Email address</label>
            <input className="form-input" id="auth-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
            <button className="button button-primary" disabled={busy} type="submit"><Mail size={16} /> {busy ? "Sending…" : "Send magic link"}</button>
          </form>
        )}
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert">{error}</div>}
      </section>
    </main>
  );
}
