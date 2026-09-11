"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clipboard, Copy, LockKeyhole, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { RoomSettingsPanel } from "@/components/room-settings";
import { ScreenHeader } from "@/components/screen-header";
import { DEFAULT_ROOM_SETTINGS, gameTypeLabel, validateRoomConfiguration, type RoomSettings } from "@/lib/rules";
import { createRoom, joinRoom } from "@/lib/supabase/actions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function LobbyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomName, setRoomName] = useState("Friday Night Heat");
  const [maxPlayers, setMaxPlayers] = useState("5");
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");
  const inviteJoinStarted = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || !searchParams.get("code") || code.trim().length < 4 || inviteJoinStarted.current) return;
    let active = true;
    const joinInvite = async () => {
      const { data } = await createClient().auth.getSession();
      if (!active || !data.session) return;
      inviteJoinStarted.current = true;
      setBusy("join");
      const result = await joinRoom(code.trim().toUpperCase());
      if (!active) return;
      setBusy(null);
      if (result.error || !result.code) {
        setError(result.error ?? "Could not join that table.");
        return;
      }
      router.replace(`/table/${result.code}`);
    };
    void joinInvite();
    return () => { active = false; };
  }, [code, router, searchParams]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomError = validateRoomConfiguration(Number(maxPlayers), settings);
    if (roomError) {
      setError(roomError);
      return;
    }
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
    if (code.trim().length < 4) return;
    setBusy("join");
    setError("");
    const result = await joinRoom(code.trim().toUpperCase());
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
        description="A name, a few house rules, and a code to share. Make yourself at home."
        kicker="Bring your people"
        title="Let’s set your table."
      />

      <div className="lobby-grid builder-grid">
        <form className="panel form-panel lobby-panel builder-form" onSubmit={handleCreate}>
          <p className="screen-kicker">01 · The essentials</p><h2>Make it yours.</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="room-name">Table name</label>
              <input className="form-input" id="room-name" onChange={(event) => setRoomName(event.target.value)} value={roomName} />
            </div>
            <div className="form-field">
              <label htmlFor="max-players">Maximum players</label>
              <input className="form-input" id="max-players" inputMode="numeric" max="8" min="2" onChange={(event) => setMaxPlayers(event.target.value)} required step="1" type="number" value={maxPlayers} />
              <span className="form-helper">2–8 seats. The hand size is checked against the 54-card deck.</span>
            </div>
            <div className="form-field">
              <label>Settings preview</label>
              <p className="form-helper">{gameTypeLabel(settings.gameType, settings.targetScore)} · {settings.initialHand}-card deal · {settings.drawMode === "one" ? "draw one" : "draw until playable"}</p>
            </div>
          </div>
          <RoomSettingsPanel idPrefix="room" maxPlayers={Number(maxPlayers)} onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))} settings={settings} />
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
            <span className="tag tag-lime"><Users size={12} /> 2–8 seats</span>
            <span className="tag">Private</span>
          </div>
        </aside>
      </div>

      <section className="join-panel" id="join-table" style={{ marginTop: 34 }}>
        <div>
          <h2>Join someone else&apos;s table</h2>
          <p>{isSupabaseConfigured() ? "Your account name is used automatically. No guest name needed." : "Demo mode is on — connect Supabase to join live tables."}</p>
        </div>
        <form className="join-form" onSubmit={handleJoin}>
          <label className="sr-only" htmlFor="lobby-code">Table code</label>
          <input className="code-input" id="lobby-code" maxLength={8} minLength={4} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} pattern="[A-Z0-9]{4,8}" placeholder="ABC123" required value={code} />
          <button className="button button-secondary" disabled={busy !== null || code.trim().length < 4} type="submit">
            <Copy size={15} />
            {busy === "join" ? "Joining…" : "Join"}
          </button>
        </form>
      </section>

      {error && <div className="alert">{error}{error.toLowerCase().includes("sign in") && <Link className="text-link" href={`/auth?next=${encodeURIComponent(`/lobby?code=${code}`)}`}>Sign in to join →</Link>}</div>}
      <p className="muted" style={{ marginTop: 20 }}><Clipboard size={13} style={{ verticalAlign: "-2px" }} /> Tip: room codes are case-insensitive.</p>
    </main>
  );
}
