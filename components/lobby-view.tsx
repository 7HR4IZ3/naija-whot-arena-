"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Clipboard, Copy, LockKeyhole, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { RoomSettingsPanel } from "@/components/room-settings";
import { ScreenHeader } from "@/components/screen-header";
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from "@/lib/rules";
import { createRoom, joinRoom } from "@/lib/supabase/actions";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function LobbyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomName, setRoomName] = useState("Friday Night Heat");
  const [maxPlayers, setMaxPlayers] = useState("5");
  const [displayName, setDisplayName] = useState("Guest Player");
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("create");
    setError("");
    const result = await createRoom({
      name: roomName.trim() || "Private Whot Table",
      maxPlayers: Number(maxPlayers),
      rules: settings,
    });
    setBusy(null);
    if (result.error || !result.code) {
      setError(result.error ?? "Could not create that table.");
      return;
    }
    try {
      window.sessionStorage.setItem(`whot:room:${result.code}:settings`, JSON.stringify(settings));
      window.sessionStorage.setItem(`whot:room:${result.code}:maxPlayers`, maxPlayers);
    } catch {
      // Session storage is only a demo-mode convenience; synced rooms use Supabase.
    }
    router.push(`/table/${result.code}`);
  };

  const handleJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("join");
    setError("");
    const result = await joinRoom(code.trim().toUpperCase(), displayName.trim() || "Guest Player");
    setBusy(null);
    if (result.error || !result.code) {
      setError(result.error ?? "Could not join that table.");
      return;
    }
    router.push(`/table/${result.code}`);
  };

  return (
    <main className="page-wrap page-builder">
      <div className="topline">
        <Link href="/play"><ArrowLeft size={14} /> BACK TO PLAY</Link>
        <strong>TABLE BUILDER</strong>
      </div>
      <ScreenHeader
        action={<Link className="button button-secondary" href="/play">Leave builder</Link>}
        description="Choose your house rules, then share the code with your crew. The host can start once everyone is ready."
        kicker="Private table"
        title={<>Set the table.<br />Send the code.</>}
      />

      <div className="lobby-grid builder-grid">
        <form className="panel form-panel lobby-panel builder-form" onSubmit={handleCreate}>
          <h2>Create a room</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="room-name">Table name</label>
              <input className="form-input" id="room-name" onChange={(event) => setRoomName(event.target.value)} value={roomName} />
            </div>
            <div className="form-field">
              <label htmlFor="max-players">Seats</label>
              <select className="form-select" id="max-players" onChange={(event) => setMaxPlayers(event.target.value)} value={maxPlayers}>
                <option value="2">2 players</option>
                <option value="3">3 players</option>
                <option value="4">4 players</option>
                <option value="5">5 players</option>
              </select>
            </div>
            <div className="form-field">
              <label>Settings preview</label>
              <p className="form-helper">{settings.gameType === "knockout" ? "Knockout scoring" : "Classic round"} · {settings.initialHand}-card deal · {settings.drawMode === "one" ? "draw one" : "draw until playable"}</p>
            </div>
          </div>
          <RoomSettingsPanel idPrefix="room" onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))} settings={settings} />
          <div className="form-actions">
            <button className="button button-primary" disabled={busy !== null} type="submit">
              <LockKeyhole size={16} />
              {busy === "create" ? "Creating…" : "Create table"}
            </button>
          </div>
        </form>

        <aside className="panel mini-note builder-note">
          <p className="screen-kicker">The waiting room</p>
          <h3>How the lobby works</h3>
          <p>When you create a table, Whot Arena gives you a six-character code and a waiting room.</p>
          <ul>
            <li>Share the code anywhere.</li>
            <li>See who has joined.</li>
            <li>Start when the table is ready.</li>
          </ul>
          <div className="tag-row" style={{ marginTop: 18 }}>
            <span className="tag tag-lime"><Users size={12} /> 2–5 seats</span>
            <span className="tag">Private</span>
          </div>
        </aside>
      </div>

      <section className="join-panel" style={{ marginTop: 34 }}>
        <div>
          <h2>Join someone else&apos;s table</h2>
          <p>{isSupabaseConfigured() ? "Sign in to sync your seat across devices." : "Demo mode is on — you can preview the full waiting room locally."}</p>
        </div>
        <form className="join-form" onSubmit={handleJoin}>
          <label className="sr-only" htmlFor="lobby-name">Your display name</label>
          <input className="form-input" id="lobby-name" onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" value={displayName} />
          <label className="sr-only" htmlFor="lobby-code">Table code</label>
          <input className="code-input" id="lobby-code" maxLength={6} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123" value={code} />
          <button className="button button-secondary" disabled={busy !== null || code.trim().length < 4} type="submit">
            <Copy size={15} />
            {busy === "join" ? "Joining…" : "Join"}
          </button>
        </form>
      </section>

      {error && <div className="alert">{error}</div>}
      <p className="muted" style={{ marginTop: 20 }}><Clipboard size={13} style={{ verticalAlign: "-2px" }} /> Tip: room codes are case-insensitive.</p>
    </main>
  );
}
