"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Plus, Trophy } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
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
    <main className="page-wrap page-events">
      <div className="topline">
        <span>WHOT ARENA / TOURNAMENTS</span>
        <strong>COMMUNITY PLAY</strong>
      </div>

      <ScreenHeader
        action={<Link className="button button-primary" href="/tournaments/new"><Plus size={15} /> Create tournament</Link>}
        description="Join before the first deal, watch the roster fill up, then battle through the bracket. Tournament settings are visible before you commit."
        kicker="Community play"
        title={<>Find your <span className="accent-word">bracket.</span></>}
      />

      <div className="events-layout">
        <section className="panel events-panel" aria-labelledby="open-tournaments-heading">
          <div className="panel-heading events-heading">
            <div>
              <p className="screen-kicker">Registration</p>
              <h2 id="open-tournaments-heading">Open tournaments</h2>
            </div>
            <Link className="text-link" href="/rules">Tournament rules</Link>
          </div>

          <div className="events-toolbar" role="tablist" aria-label="Tournament filters">
            {(["All", "Open", "Full"] as Filter[]).map((item) => (
              <button
                aria-selected={filter === item}
                className={`tab-button${filter === item ? " active" : ""}`}
                key={item}
                onClick={() => setFilter(item)}
                role="tab"
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="event-list">
            {tournaments.map((tournament) => {
              const isJoined = joined.includes(tournament.id);
              const isFull = tournament.status === "Full";
              return (
                <article className="event-row" key={tournament.id}>
                  <div className="event-copy">
                    <p className="event-name">{tournament.title}</p>
                    <p className="event-meta">{tournament.description} · {tournament.players}</p>
                    <div className="tag-row event-tags">
                      <span className="tag"><CalendarDays size={11} /> {tournament.time}</span>
                      <span className="tag"><Trophy size={11} /> {tournament.prize}</span>
                    </div>
                  </div>
                  <span className={`event-status${isFull ? " is-full" : ""}`}>{tournament.status}</span>
                  <div className="event-actions">
                    <Link className="text-link" href={`/tournaments/${tournament.id}`}><ArrowRight size={13} /> View</Link>
                    <button className="button button-secondary" disabled={isFull} onClick={() => toggleJoin(tournament.id)} type="button">
                      {isJoined ? "Joined" : isFull ? "Waitlist" : "Join"}
                    </button>
                  </div>
                </article>
              );
            })}
            {!tournaments.length && <p className="empty-state">No tournaments match this filter yet.</p>}
          </div>
        </section>

        <aside className="panel mini-note events-note">
          <p className="screen-kicker">Before you join</p>
          <p><strong>Know the table first.</strong><br />See the format, rules, start time, and open seats in one place. The host starts only when the bracket is full or ready.</p>
          <Link className="text-link" href="/tournaments/new">Host an event <ArrowRight size={13} /></Link>
        </aside>
      </div>

      <div className="home-footnote events-footnote">
        <article className="panel mini-note"><p><strong>Registration stays open.</strong><br />Players can inspect the published rules before joining.</p></article>
        <article className="panel mini-note"><p><strong>Host-controlled start.</strong><br />The roster locks when the bracket is ready to run.</p></article>
      </div>
    </main>
  );
}
