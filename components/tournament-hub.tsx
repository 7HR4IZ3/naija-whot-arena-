"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Plus, Trophy } from "lucide-react";
import { MOCK_TOURNAMENTS } from "@/lib/mock-data";

type Filter = "All" | "Open" | "Full";

export function TournamentHub() {
  const [filter, setFilter] = useState<Filter>("All");
  const [joined, setJoined] = useState<string[]>([]);
  const tournaments = useMemo(
    () => MOCK_TOURNAMENTS.filter((tournament) => filter === "All" || tournament.status === filter),
    [filter],
  );

  const toggleJoin = (id: string) => {
    setJoined((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <main className="page-wrap">
      <div className="topline">
        <span>WHOT ARENA / EVENTS</span>
        <strong>BRAGGING RIGHTS DEPARTMENT</strong>
      </div>
      <header className="page-header">
        <div>
          <span className="eyebrow">Open tables, bigger stakes</span>
          <h1>Find your<br /><span style={{ background: "var(--yellow)", padding: "0 8px" }}>bracket.</span></h1>
        </div>
        <p>Join before the first deal, watch the roster fill up, then battle through the bracket. Tournament settings are visible before you commit.</p>
      </header>

      <div className="filter-row">
        <div className="tab-row" role="tablist" aria-label="Tournament filters">
          {(["All", "Open", "Full"] as Filter[]).map((item) => (
            <button className={`tab-button${filter === item ? " active" : ""}`} key={item} onClick={() => setFilter(item)} role="tab" type="button">{item}</button>
          ))}
        </div>
        <Link className="button button-primary" href="/tournaments/new"><Plus size={16} /> Create tournament</Link>
      </div>

      <div className="tournament-list">
        {tournaments.map((tournament) => {
          const isJoined = joined.includes(tournament.id);
          const isFull = tournament.status === "Full";
          return (
            <article className="tournament-card" key={tournament.id}>
              <div className="tournament-date"><strong>{tournament.day}</strong><span>{tournament.month}</span></div>
              <div>
                <h3>{tournament.title}</h3>
                <p>{tournament.description}</p>
                <div className="tag-row" style={{ marginTop: 9 }}>
                  <span className="tag"><CalendarDays size={11} /> {tournament.time}</span>
                  <span className="tag"><Trophy size={11} /> {tournament.prize}</span>
                </div>
                <span className="tournament-status" style={{ marginTop: 10 }}>{tournament.players}</span>
              </div>
              <div className="button-row" style={{ marginTop: 0, justifyContent: "end" }}>
                <Link className="button button-quiet" href={`/tournaments/${tournament.id}`}><ArrowRight size={14} /> View</Link>
                <button className="button button-secondary" disabled={isFull} onClick={() => toggleJoin(tournament.id)} type="button">
                  {isJoined ? "Joined" : isFull ? "Waitlist" : "Join"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rules-callout" style={{ marginTop: 24 }}>
        <strong>Organizer note:</strong> tournament hosts can set the player cap, start time, knockout scoring, timers, stacking, and whether the table uses classic or house rules. Registration closes when the host starts the event.
      </div>
    </main>
  );
}
