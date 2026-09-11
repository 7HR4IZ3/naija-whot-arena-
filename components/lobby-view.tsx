"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clipboard, LockKeyhole, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { InviteJoin } from "@/components/invite-join";
import { RoomSettingsPanel } from "@/components/room-settings";
import { ScreenHeader } from "@/components/screen-header";
import { DEFAULT_ROOM_SETTINGS, gameTypeLabel, MAX_ROOM_PLAYERS, MIN_ROOM_PLAYERS, validateRoomConfiguration, type RoomSettings } from "@/lib/rules";
import { createRoom, joinRoom } from "@/lib/supabase/actions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function LobbyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("5");
  const inviteCode = searchParams.get("code")?.replace(/[^a-z0-9]/gi, "").toUpperCase() ?? "";
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");
  const inviteJoinStarted = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || inviteCode.length < 4 || inviteJoinStarted.current) return;
    let active = true;
    const joinInvite = async () => {
      const { data } = await createClient().auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace(`/auth?next=${encodeURIComponent(`/lobby?code=${inviteCode}`)}`);
        return;
      }
      inviteJoinStarted.current = true;
      setBusy("join");
      const result = await joinRoom(inviteCode);
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
  }, [inviteCode, router]);

  const configurationError = validateRoomConfiguration(Number(maxPlayers), settings);

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

  return (
    <main className={`page-wrap page-builder ${inviteCode ? "has-invite" : ""}`}>
      <div className="topline">
        <Link href="/play"><ArrowLeft size={14} /> BACK TO PLAY</Link>
        <strong>TABLE BUILDER</strong>
      </div>
      <ScreenHeader
        action={<Link className="button button-secondary" href="/play">Leave builder</Link>}
        description={inviteCode ? (busy === "join" ? "Joining your friends…" : "Join the table from your invite.") : "Choose the basics. Share an invite when you’re ready."}
        kicker="Bring your people"
        title={inviteCode ? "Join a game" : "Create a game"}
      />

      <div className="lobby-grid builder-grid">
        <form className="panel form-panel lobby-panel builder-form" onSubmit={handleCreate}>
          <h2>Game details</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="room-name">Table name (optional)</label>
              <input className="form-input" id="room-name" onChange={(event) => setRoomName(event.target.value)} value={roomName} />
            </div>
            <div className="form-field">
              <label htmlFor="max-players">Maximum players</label>
              <input aria-describedby="room-cap-help" aria-invalid={Boolean(configurationError)} className="form-input" id="max-players" inputMode="numeric" max={MAX_ROOM_PLAYERS} min={MIN_ROOM_PLAYERS} onChange={(event) => { setError(""); setMaxPlayers(event.target.value); }} required step="1" type="number" value={maxPlayers} />
              <span className="form-helper" id="room-cap-help">{MIN_ROOM_PLAYERS}–{MAX_ROOM_PLAYERS} seats. The opening hand is checked against the deck.</span>
            </div>
            <div className="form-field">
              <label>Settings preview</label>
              <p className="form-helper">{gameTypeLabel(settings.gameType, settings.targetScore)} · {settings.initialHand}-card deal · {settings.drawMode === "one" ? "draw one" : "draw until playable"}</p>
            </div>
          </div>
          <RoomSettingsPanel idPrefix="room" maxPlayers={Number(maxPlayers)} onChange={(patch) => { setError(""); setSettings((current) => ({ ...current, ...patch })); }} settings={settings} />
          {configurationError && <p className="form-error" role="alert">{configurationError}</p>}
          <div className="form-actions">
            <button className="button button-primary" disabled={busy !== null || Boolean(configurationError)} type="submit">
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
          <p>{isSupabaseConfigured() ? "Enter the invite code and continue with your account name." : "Demo mode is on — connect Supabase to join live tables."}</p>
        </div>
        <InviteJoin key={inviteCode || "join"} id="lobby-code" initialCode={inviteCode} />
      </section>

      {error && <div className="alert">{error}{error.toLowerCase().includes("sign in") && <Link className="text-link" href={`/auth?next=${encodeURIComponent(`/lobby?code=${inviteCode}`)}`}>Sign in to join →</Link>}</div>}
      <p className="muted" style={{ marginTop: 20 }}><Clipboard size={13} style={{ verticalAlign: "-2px" }} /> Tip: room codes are case-insensitive.</p>
    </main>
  );
}
