"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole, Trophy, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

type Mode = "quick" | "private" | "tournament";

const modes: Array<{ id: Mode; title: string; description: string; icon: typeof Zap; detail: string }> = [
  { id: "quick", title: "Quick match", description: "Drop into a live table and get dealt in fast.", icon: Zap, detail: "Fast queue · classic rules" },
  { id: "private", title: "Private table", description: "Set the rules, share a code, and wait for your people.", icon: LockKeyhole, detail: "2–5 players · invite code" },
  { id: "tournament", title: "Tournament", description: "Build an event, open registration, and run the bracket.", icon: Trophy, detail: "Elimination · standings" },
];

export function PlayHub() {
  const router = useRouter();
  const [selected, setSelected] = useState<Mode>("quick");
  const [code, setCode] = useState("");

  const startSelected = () => {
    if (selected === "quick") router.push("/game");
    if (selected === "private") router.push("/lobby");
    if (selected === "tournament") router.push("/tournaments/new");
  };

  const joinByCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized) router.push(`/lobby?code=${normalized}`);
  };

  return (
    <main className="page-wrap">
      <div className="topline">
        <span>WHOT ARENA / PLAY</span>
        <strong>CHOOSE YOUR CHAOS</strong>
      </div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Three ways to deal</span>
          <h1>Pick a mode.<br />Make a move.</h1>
        </div>
        <p>All modes use the same 54-card Nigerian Whot deck. The difference is who is around the table and how serious the score gets.</p>
      </header>

      <div className="mode-grid">
        {modes.map(({ id, title, description, icon: Icon, detail }) => (
          <button
            className={`mode-card${selected === id ? " selected" : ""}`}
            key={id}
            onClick={() => setSelected(id)}
            type="button"
            style={{ textAlign: "left" }}
          >
            <span className="mode-icon"><Icon size={22} strokeWidth={3} /></span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="mode-meta">{detail}</span>
          </button>
        ))}
      </div>

      <div className="button-row">
        <button className="button button-primary" onClick={startSelected} type="button">
          Start {selected === "quick" ? "quick match" : selected === "private" ? "private table" : "tournament"}
          <ArrowRight size={16} />
        </button>
        <span className="muted" style={{ alignSelf: "center" }}>No account needed for the local demo.</span>
      </div>

      <section className="join-panel">
        <div>
          <h2>Got a table code?</h2>
          <p>Enter the six-character code from your host and sit down.</p>
        </div>
        <form className="join-form" onSubmit={joinByCode}>
          <label className="sr-only" htmlFor="play-code">Table code</label>
          <input className="code-input" id="play-code" maxLength={6} onChange={(event) => setCode(event.target.value)} placeholder="ABC123" value={code} />
          <button className="button button-secondary" disabled={code.trim().length < 4} type="submit">Join</button>
        </form>
      </section>

      <div className="stats-strip">
        <div className="stat-cell"><span className="stat-value">2–5</span><span className="stat-label">Players per table</span></div>
        <div className="stat-cell"><span className="stat-value">10s</span><span className="stat-label">Optional turn timer</span></div>
        <div className="stat-cell"><span className="stat-value"><Users size={27} strokeWidth={3} /></span><span className="stat-label">Public or private</span></div>
      </div>
    </main>
  );
}
