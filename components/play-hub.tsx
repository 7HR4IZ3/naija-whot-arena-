"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole, Trophy, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/screen-header";

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
    <main className="page-wrap page-play">
      <div className="topline">
        <span>WHOT ARENA / PLAY</span>
        <strong>CHOOSE YOUR TABLE</strong>
      </div>

      <ScreenHeader
        action={<button className="button button-primary" onClick={startSelected} type="button">Start selected mode <ArrowRight size={15} /></button>}
        description="All modes use the same 54-card Nigerian Whot deck. Pick the kind of table you want, then make your move."
        kicker="Three ways to deal"
        title={<>Pick a mode.<br />Make a move.</>}
      />

      <section className="mode-grid" aria-label="Game modes">
        {modes.map(({ id, title, description, icon: Icon, detail }) => (
          <button
            aria-pressed={selected === id}
            className={`mode-card${selected === id ? " selected" : ""}`}
            key={id}
            onClick={() => setSelected(id)}
            type="button"
          >
            <span className="mode-icon"><Icon size={19} strokeWidth={1.8} /></span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="mode-meta">{detail}</span>
          </button>
        ))}
      </section>

      <section className="join-panel" aria-labelledby="join-code-heading">
        <div>
          <p className="screen-kicker">Already invited?</p>
          <h2 id="join-code-heading">Got a table code?</h2>
          <p>Enter the code from your host and sit down.</p>
        </div>
        <form className="join-form" onSubmit={joinByCode}>
          <label className="sr-only" htmlFor="play-code">Table code</label>
          <input className="code-input" id="play-code" maxLength={6} onChange={(event) => setCode(event.target.value)} placeholder="ABC123" value={code} />
          <button className="button button-secondary" disabled={code.trim().length < 4} type="submit">Join</button>
        </form>
      </section>

      <section className="home-footnote play-footnote" aria-label="Play mode details">
        <article className="panel mini-note"><p><strong>Quick match</strong><br />Classic rules, fast queue, no setup.</p></article>
        <article className="panel mini-note"><p><strong>Private or public</strong><br />Create a room, share the code, and wait together.</p></article>
      </section>
    </main>
  );
}
