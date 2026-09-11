"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { RoomSettingsPanel } from "@/components/room-settings";
import { ScreenHeader } from "@/components/screen-header";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/lib/rules";
import { createTournament } from "@/lib/supabase/actions";

export function TournamentCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("32");
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_ROOM_SETTINGS, gameType: "knockout" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const seats = Number(maxPlayers);
    const start = startsAt ? new Date(startsAt) : null;
    if (!name.trim() || !Number.isInteger(seats) || seats < 4 || seats > 128) {
      setError("Enter an event name and choose between 4 and 128 players.");
      return;
    }
    if (!start || Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      setError("Choose a start time in the future.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await createTournament({
      name: name.trim() || "New Whot Tournament",
      startsAt: start.toISOString(),
      maxPlayers: seats,
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
    <main className="page-wrap page-builder">
      <div className="topline">
        <Link href="/tournaments"><ArrowLeft size={14} /> BACK TO EVENTS</Link>
        <strong>EVENT BUILDER</strong>
      </div>
      <ScreenHeader
        action={<Link className="button button-secondary" href="/tournaments">Back to tournaments</Link>}
        description="Give your event a name, pick a time, and invite the competition."
        kicker="Host an event"
        title="Create tournament"
      />

      <div className="settings-layout builder-settings-layout">
        <article className="panel settings-intro">
          <p className="screen-kicker">Registration first</p>
          <h2>Give the table a reason to show up.</h2>
          <p>Set the format, publish the house rules, and give players a clear place to gather before the bracket begins.</p>
        </article>

        <form className="panel settings-form form-panel builder-form" onSubmit={submit}>
          <h2>Event details</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="tournament-name">Event name</label>
              <input className="form-input" id="tournament-name" onChange={(event) => setName(event.target.value)} value={name} />
            </div>
            <div className="form-field">
              <label htmlFor="starts-at">Start time</label>
              <input className="form-input" id="starts-at" required onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" value={startsAt} />
            </div>
            <div className="form-field">
              <label htmlFor="tournament-cap">Player cap</label>
              <input className="form-input" id="tournament-cap" inputMode="numeric" max="128" min="4" onChange={(event) => setMaxPlayers(event.target.value)} required step="1" type="number" value={maxPlayers} />
              <span className="form-helper">4–128 players can register before the bracket starts.</span>
            </div>
          </div>
          <RoomSettingsPanel description="Publish a clear ruleset with the registration page so every player joins with the same expectations." idPrefix="tournament" onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))} settings={settings} title="Published rules" />
          <div className="form-actions">
            <button className="button button-primary" disabled={busy} type="submit"><Crown size={16} /> {busy ? "Publishing…" : "Publish tournament"}</button>
          </div>
        </form>
      </div>

      <section className="home-footnote builder-footnote" aria-label="Tournament registration details">
        <article className="panel mini-note"><p><strong>What players see.</strong><br />Event name, start time, rules, live player count, and seats left.</p></article>
        <article className="panel mini-note"><p><strong>Registration stays open.</strong><br />Your event starts in registration mode. The host controls the final start.</p></article>
      </section>

      {error && <div className="alert">{error}</div>}
    </main>
  );
}
