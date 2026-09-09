"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Crown, Play, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { MOCK_TOURNAMENTS } from "@/lib/mock-data";
import { DEFAULT_ROOM_SETTINGS, gameTypeLabel, normalizeRoomSettings, penaltyModeLabel, type RoomSettings } from "@/lib/rules";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { joinTournament } from "@/lib/supabase/actions";

type TournamentInfo = {
  name: string;
  max_players: number;
  starts_at: string;
  status: string;
  rule_config: Record<string, unknown>;
};

const demoPlayers = ["Tayo", "Amaka", "Kelechi", "Mide", "Zainab"];

export function TournamentRoom({ id }: { id: string }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const mock = MOCK_TOURNAMENTS.find((tournament) => tournament.id === id);
  const initialSettings = normalizeRoomSettings(mock ? { ...DEFAULT_ROOM_SETTINGS, gameType: "knockout" } : DEFAULT_ROOM_SETTINGS);
  const [tournament, setTournament] = useState<TournamentInfo>({
    name: mock?.title ?? "Demo tournament",
    max_players: mock?.players.match(/\d+/)?.[0] ? Number(mock.players.match(/\d+/)?.[0]) : 32,
    starts_at: "2026-09-12T21:00:00.000Z",
    status: mock?.status === "Full" ? "full" : "registration",
    rule_config: initialSettings,
  });
  const [settings, setSettings] = useState<RoomSettings>(initialSettings);
  const [players, setPlayers] = useState<string[]>(demoPlayers.slice(0, mock?.status === "Full" ? 5 : 3));
  const [displayName, setDisplayName] = useState("Guest Player");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured || id === "demo-tournament") return;
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data, error: tournamentError } = await supabase.from("tournaments").select("name, max_players, starts_at, status, rule_config").eq("id", id).single();
      if (!active) return;
      if (tournamentError || !data) {
        setError("Could not load this synced tournament. Showing the preview.");
        return;
      }
      setTournament(data as TournamentInfo);
      setSettings(normalizeRoomSettings(data.rule_config));
      const { data: roster } = await supabase.from("tournament_players").select("display_name").eq("tournament_id", id).order("seed");
      if (active && roster) setPlayers(roster.map((player: { display_name: string }) => player.display_name));
    };
    void load();
    return () => { active = false; };
  }, [configured, id]);

  const join = async () => {
    if (players.length >= tournament.max_players) return;
    setError("");
    if (configured && id !== "demo-tournament") {
      const result = await joinTournament(id, displayName.trim() || "Guest Player");
      if (result.error) {
        setError(result.error);
        return;
      }
    }
    setJoined(true);
    setPlayers((current) => current.includes(displayName.trim() || "Guest Player") ? current : [...current, displayName.trim() || "Guest Player"]);
  };

  const start = async () => {
    if (configured && id !== "demo-tournament") {
      const { error: startError } = await createClient().from("tournaments").update({ status: "running" }).eq("id", id);
      if (startError) {
        setError(startError.message);
        return;
      }
    }
    router.push(`/game?tournament=${id}`);
  };

  const startLabel = new Date(tournament.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  const isFull = players.length >= tournament.max_players || tournament.status === "full";

  return (
    <main className="page-wrap">
      <div className="topline">
        <Link href="/tournaments"><ArrowLeft size={14} /> BACK TO EVENTS</Link>
        <strong>EVENT ROOM</strong>
      </div>
      <header className="page-header">
        <div>
          <span className="eyebrow">{tournament.status === "registration" ? "Registration open" : "Event room"}</span>
          <h1>{tournament.name}.<br /><span style={{ color: "var(--pink)" }}>{players.length}/{tournament.max_players} in.</span></h1>
        </div>
        <p>See the rules, join the roster, and wait for the host to start the bracket.</p>
      </header>

      <div className="form-shell">
        <section className="lobby-card">
          <div className="tag-row">
            <span className="tag tag-lime"><CalendarDays size={11} /> {startLabel}</span>
            <span className="tag"><Crown size={11} /> {gameTypeLabel(settings.gameType, settings.targetScore)}</span>
            <span className="tag"><Users size={11} /> {isFull ? "Full" : `${tournament.max_players - players.length} seats left`}</span>
          </div>
          <h2 style={{ marginTop: 25 }}>The roster</h2>
          <div className="roster">
            {players.map((player, index) => (
              <div className="roster-row" key={`${player}-${index}`}>
                <div className="roster-person"><span className="avatar-dot" style={{ marginLeft: 0, background: index % 2 ? "var(--blue)" : "var(--yellow)" }}>{player.slice(0, 1).toUpperCase()}</span>{player}</div>
                {index === 0 && <span className="ready-state">Seed 01</span>}
              </div>
            ))}
          </div>
          <div className="join-form" style={{ marginTop: 22 }}>
            <label className="sr-only" htmlFor="tournament-display-name">Your name</label>
            <input className="form-input" id="tournament-display-name" onChange={(event) => setDisplayName(event.target.value)} value={displayName} />
            <button className="button button-primary" disabled={joined || isFull} onClick={join} type="button"><Check size={16} /> {joined ? "You're in" : isFull ? "Full" : "Join event"}</button>
          </div>
        </section>

        <aside className="side-note">
          <h3>Published rules</h3>
          <ul>
            <li>{gameTypeLabel(settings.gameType, settings.targetScore)}</li>
            <li>{settings.pickTwoEnabled ? `2 Pick Two · ${penaltyModeLabel(settings.pickTwoMode)}` : "2 Pick Two disabled"}</li>
            <li>{settings.pickThreeEnabled ? `5 Pick Three · ${penaltyModeLabel(settings.pickThreeMode)}` : "5 Pick Three disabled"}</li>
            <li>{settings.initialHand}-card opening deal · {settings.turnTimer === "off" ? "untimed" : `${settings.turnTimer}-second timer`}</li>
          </ul>
          <button className="button button-primary" disabled={!joined && !isFull} onClick={start} style={{ marginTop: 18, width: "100%" }} type="button"><Play size={16} fill="currentColor" /> Host starts bracket</button>
          <p className="form-helper" style={{ marginTop: 11 }}>Demo mode lets you preview the bracket. A synced event is host-controlled.</p>
        </aside>
      </div>
      {error && <div className="alert">{error}</div>}
    </main>
  );
}
