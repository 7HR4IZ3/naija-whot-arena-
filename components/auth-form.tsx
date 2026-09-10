"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
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
    <main className="page-wrap page-auth">
      <div className="topline">
        <span>WHOT ARENA / ACCOUNT</span>
        <strong>YOUR TABLE, WHEREVER YOU ARE</strong>
      </div>

      <ScreenHeader
        action={<Link className="button button-secondary" href="/"><ArrowLeft size={14} /> Back home</Link>}
        description="Sign in to create synced rooms, join tournaments, and keep your table identity across devices."
        kicker="Your table, wherever you are"
        title={<>Stay in the<br /><span className="accent-word">game.</span></>}
      />

      <div className="auth-layout">
        <section className="panel auth-card">
          <p className="screen-kicker">Magic link sign in</p>
          <h2>Welcome back.</h2>
          {!configured ? (
            <div className="rules-callout"><strong>Demo mode is active.</strong> Add your Supabase URL and anon key to enable magic-link auth and realtime lobbies. You can still play the local match now.</div>
          ) : (
            <form onSubmit={signIn}>
              <label htmlFor="auth-email">Email address</label>
              <div className="auth-input-row">
                <input className="form-input" id="auth-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
                <button className="button button-primary" disabled={busy} type="submit"><Mail size={16} /> {busy ? "Sending…" : "Send magic link"}</button>
              </div>
            </form>
          )}
          {message && <div className="alert success">{message}</div>}
          {error && <div className="alert">{error}</div>}
        </section>

        <aside className="panel mini-note auth-note">
          <p className="screen-kicker">What syncs</p>
          <p><strong>Keep your seat.</strong><br />Rooms, tournament registration, and table identity stay available across devices when Supabase is connected.</p>
          <Link className="text-link" href="/rules">Read the rules first</Link>
        </aside>
      </div>
    </main>
  );
}
