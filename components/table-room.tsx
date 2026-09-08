"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Info, Play, RefreshCw, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type RosterPlayer = { id: string; display_name: string; seat: number; ready: boolean };

const demoRoster: RosterPlayer[] = [
  { id: "you", display_name: "You", seat: 1, ready: true },
  { id: "amaka", display_name: "Amaka", seat: 2, ready: true },
  { id: "kelechi", display_name: "Kelechi", seat: 3, ready: false },
];

export function TableRoom({ code }: { code: string }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [players, setPlayers] = useState<RosterPlayer[]>(demoRoster);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("Private Whot Table");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const normalizedCode = code.toUpperCase();

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const loadRoom = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: room, error: roomError } = await supabase.from("rooms").select("id, name, host_id, status").eq("code", normalizedCode).single();
      if (!active) return;
      if (roomError || !room) {
        setError("This synced room could not be found. Showing the local preview instead.");
        return;
      }
      setRoomId(room.id);
      setHostId(room.host_id);
      setUserId(userData.user?.id ?? null);
      setRoomName(room.name);
      if (room.status === "running") router.push(`/game?room=${normalizedCode}`);

      const { data: roster, error: rosterError } = await supabase
        .from("room_players")
        .select("id, display_name, seat, ready")
        .eq("room_id", room.id)
        .order("seat");
      if (!active) return;
      if (!rosterError && roster) setPlayers(roster as RosterPlayer[]);

      channel = supabase
        .channel(`room-${room.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${room.id}` }, loadRoom)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, loadRoom)
        .subscribe();
    };

    void loadRoom();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [configured, normalizedCode, router]);

  const readyCount = players.filter((player) => player.ready).length;
  const isHost = !configured || Boolean(userId && hostId && userId === hostId);
  const me = useMemo(() => players.find((player) => player.id === userId || (!configured && player.id === "you")), [configured, players, userId]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const toggleReady = async () => {
    const nextReady = !(me?.ready ?? false);
    setPlayers((current) => current.map((player) => player.id === (me?.id ?? "you") ? { ...player, ready: nextReady } : player));
    if (!configured || !roomId || !userId) return;
    const { error: updateError } = await createClient().from("room_players").update({ ready: nextReady }).eq("room_id", roomId).eq("user_id", userId);
    if (updateError) setError(updateError.message);
  };

  const startTable = async () => {
    if (configured && roomId && isHost) {
      const { error: startError } = await createClient().from("rooms").update({ status: "running" }).eq("id", roomId);
      if (startError) {
        setError(startError.message);
        return;
      }
    }
    router.push(`/game?room=${normalizedCode}`);
  };

  return (
    <main className="page-wrap">
      <div className="topline">
        <Link href="/play"><ArrowLeft size={14} /> BACK TO PLAY</Link>
        <strong>WAITING ROOM / {normalizedCode}</strong>
      </div>
      <header className="page-header">
        <div>
          <span className="eyebrow">{configured ? "Synced table" : "Demo table"}</span>
          <h1>{roomName}.<br /><span style={{ color: "var(--pink)" }}>Who&apos;s ready?</span></h1>
        </div>
        <p>Invite the table, check the house rules, and start when every seat is locked in.</p>
      </header>

      <div className="form-shell">
        <section className="lobby-card">
          <div className="deck-panel-top">
            <h2 style={{ margin: 0 }}>Players <span className="muted">{players.length}/5</span></h2>
            <span className="tag tag-lime"><Users size={12} /> {readyCount} ready</span>
          </div>
          <div className="room-code-block">
            <div><span>Share this table code</span><strong>{normalizedCode}</strong></div>
            <button className="button button-secondary" onClick={copyCode} type="button"><Copy size={15} /> {copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="roster" style={{ marginTop: 20 }}>
            {players.map((player, index) => (
              <div className="roster-row" key={player.id}>
                <div className="roster-person">
                  <span className="avatar-dot" style={{ marginLeft: 0, background: index === 0 ? "var(--yellow)" : index === 1 ? "var(--blue)" : "var(--pink)" }}>{player.display_name.slice(0, 1).toUpperCase()}</span>
                  <span>{player.display_name}{player.id === userId || (!configured && player.id === "you") ? " (you)" : ""}</span>
                </div>
                <span className={player.ready ? "ready-state" : "muted"}>{player.ready ? "Ready" : "Not ready"}</span>
              </div>
            ))}
          </div>
          <div className="button-row" style={{ justifyContent: "space-between" }}>
            <button className="button button-secondary" onClick={toggleReady} type="button"><Check size={16} /> {me?.ready ? "Unready" : "Ready up"}</button>
            {isHost && <button className="button button-primary" disabled={players.length < 2 || readyCount < 2} onClick={startTable} type="button"><Play size={16} fill="currentColor" /> Start game</button>}
          </div>
          {players.length < 2 && <p className="waiting-note"><Info size={15} /> You need at least two players to start. Keep sharing the code.</p>}
          {readyCount < 2 && players.length >= 2 && <p className="waiting-note"><RefreshCw size={15} /> Waiting for at least two ready players.</p>}
        </section>

        <aside className="side-note">
          <h3>Table rules</h3>
          <ul>
            <li>Six cards to each player.</li>
            <li>Match the top card by number or symbol.</li>
            <li>Stack 2s and 5s when defended.</li>
            <li>Call a symbol after playing Whot.</li>
            <li>First player with no cards wins the round.</li>
          </ul>
          <div className="tag-row" style={{ marginTop: 18 }}>
            <span className="tag tag-lime">Classic</span>
            <span className="tag">{configured ? "Realtime" : "Local preview"}</span>
          </div>
        </aside>
      </div>

      {error && <div className="alert">{error}</div>}
    </main>
  );
}
