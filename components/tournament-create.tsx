"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Crown, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { RoomSettingsPanel } from "@/components/room-settings";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/lib/rules";
import { createTournament } from "@/lib/supabase/actions";

export function TournamentCreate() {
  const router = useRouter();
  const [name, setName] = useState("Lagos After Dark");
  const [startsAt, setStartsAt] = useState("2026-09-12T21:00");
  const [maxPlayers, setMaxPlayers] = useState("32");
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_ROOM_SETTINGS, gameType: "knockout" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await createTournament({
      name: name.trim() || "New Whot Tournament",
      startsAt,
      maxPlayers: Number(maxPlayers),
      rules: { ...settings, registration: "open" },
    });
    setBusy(false);
    if (result.error || !result.id) {
      setError(result.error ?? "Could not create the tournament.");
      return;
    }
    router.push(`/tournaments/${result.id}`);
  };

  return (
    <main className="page-wrap">
      <div className="topline">
        <Link href="/tournaments"><ArrowLeft size={14} /> BACK TO EVENTS</Link>
        <strong>EVENT BUILDER</strong>
      </div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Host an event</span>
          <h1>Make it<br /><span style={{ color: "var(--pink)" }}>official.</span></h1>
        </div>
        <p>Create an open registration, publish the rules, and let players join before the bracket locks.</p>
      </header>

      <div className="form-shell">
        <form className="form-panel" onSubmit={submit}>
          <h2>Tournament details</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="tournament-name">Event name</label>
              <input className="form-input" id="tournament-name" onChange={(event) => setName(event.target.value)} value={name} />
            </div>
            <div className="form-field">
              <label htmlFor="starts-at">Start time</label>
              <input className="form-input" id="starts-at" onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" value={startsAt} />
            </div>
            <div className="form-field">
              <label htmlFor="tournament-cap">Player cap</label>
              <select className="form-select" id="tournament-cap" onChange={(event) => setMaxPlayers(event.target.value)} value={maxPlayers}>
                <option value="8">8 players</option>
                <option value="16">16 players</option>
                <option value="32">32 players</option>
                <option value="64">64 players</option>
              </select>
            </div>
          </div>
          <RoomSettingsPanel description="Publish a clear ruleset with the registration page so every player joins with the same expectations." idPrefix="tournament" onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))} settings={settings} title="Published rules" />
          <div className="form-actions">
            <button className="button button-primary" disabled={busy} type="submit"><Crown size={16} /> {busy ? "Publishing…" : "Publish tournament"}</button>
          </div>
        </form>

        <aside className="side-note">
          <h3>What players see</h3>
          <ul>
            <li>Event name and start time.</li>
            <li>Rules before they join.</li>
            <li>Live player count and seats left.</li>
            <li>Waiting room when registration closes.</li>
          </ul>
          <div className="rules-callout" style={{ marginTop: 20, background: "var(--yellow)" }}><Info size={14} style={{ verticalAlign: "-2px" }} /> Your event starts in registration mode. The host controls the final start.</div>
        </aside>
      </div>

      {error && <div className="alert">{error}</div>}
    </main>
  );
}
