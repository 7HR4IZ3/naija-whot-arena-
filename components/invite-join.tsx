"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinRoom } from "@/lib/supabase/actions";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function InviteJoin({ id = "invite-code", compact = false }: { id?: string; compact?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (normalized.length < 4 || normalized.length > 8) {
      setError("Enter the 4–8 character invite code.");
      return;
    }
    setError("");
    if (!isSupabaseConfigured()) {
      router.push(`/lobby?code=${normalized}#join-table`);
      return;
    }
    setBusy(true);
    const result = await joinRoom(normalized);
    setBusy(false);
    if (result.code) {
      router.push(`/table/${result.code}`);
      return;
    }
    if (result.error?.toLowerCase().includes("sign in")) {
      router.push(`/auth?next=${encodeURIComponent(`/lobby?code=${normalized}`)}`);
      return;
    }
    setError(result.error ?? "That invite code could not be joined.");
  };

  return <div className={`invite-join ${compact ? "is-compact" : ""}`}>
    <form onSubmit={submit}>
      <label htmlFor={id}>Invite code</label>
      <div className="invite-join-row">
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          autoCapitalize="characters"
          className="code-input"
          id={id}
          inputMode="text"
          maxLength={8}
          minLength={4}
          onChange={(event) => { setError(""); setCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase()); }}
          pattern="[A-Z0-9]{4,8}"
          placeholder="ABC123"
          required
          value={code}
        />
        <button aria-label="Join table with invite code" className="button button-primary" disabled={busy || code.length < 4} type="submit">
          {busy ? "Joining…" : compact ? <ArrowRight size={18} /> : <>Join table <ArrowRight size={16} /></>}
        </button>
      </div>
      {error && <small className="invite-join-error" id={`${id}-error`} role="alert">{error}</small>}
    </form>
  </div>;
}
