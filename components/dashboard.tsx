import Link from "next/link";
import { ArrowRight, Play, Plus, Users } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { createCard } from "@/lib/cards";
import { MOCK_ROOMS } from "@/lib/mock-data";

export function Dashboard() {
  return (
    <main className="page-wrap">
      <div className="topline">
        <span>WHOT ARENA / HOME</span>
        <strong>LIVE TABLES · LAGOS + ABUJA</strong>
      </div>

      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="eyebrow">The Nigerian card game, online</span>
          <h1 className="display-title">Play loud.<br /><em>Call Whot.</em></h1>
          <p className="lead">
            A proper home for Naija Whot: quick matches, private tables, and tournaments with room to talk your talk.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/play">
              <Play size={16} fill="currentColor" />
              Start a game
            </Link>
            <Link className="button button-secondary" href="/rules">
              Learn the rules
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="hero-deck" aria-label="A stack of Whot cards">
          <div className="hero-card-stack">
            <CardFace card={createCard("circle", 8)} />
            <CardFace card={createCard("star", 5)} />
            <CardFace card={createCard("whot", 20)} />
          </div>
          <span className="hero-card-label">54 cards.<br />Many ways to cause a scene.</span>
        </div>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Find your table</span>
            <h2>Tables with heat.</h2>
          </div>
          <p>Jump into an open room, make your own private code, or queue for a tournament bracket.</p>
        </div>

        <div className="dashboard-grid">
          <div className="panel panel-pad">
            <div className="room-list">
              {MOCK_ROOMS.map((room) => (
                <div className="room-row" key={room.name}>
                  <div>
                    <p className="room-name">{room.name}</p>
                    <div className="tag-row">
                      {room.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                    </div>
                    <div className="room-meta">Hosted by {room.host}</div>
                  </div>
                  <div className="room-players">
                    <span className="avatar-stack">
                      {room.initials.map((initial, index) => (
                        <span className="avatar-dot" key={`${room.name}-${initial}`} style={{ background: index % 2 ? "var(--blue)" : "var(--pink)" }}>{initial}</span>
                      ))}
                    </span>
                    <span>{room.players}/{room.maxPlayers}</span>
                  </div>
                  <Link className="button button-quiet" href={`/table/${room.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    Join
                  </Link>
                </div>
              ))}
            </div>
            <div className="button-row" style={{ marginTop: 17 }}>
              <Link className="button button-secondary" href="/lobby">
                <Plus size={16} />
                Make a table
              </Link>
              <Link className="button button-secondary" href="/tournaments">
                See all events <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="panel panel-pad deck-panel">
            <div className="deck-panel-top">
              <h3>Tonight&apos;s deck</h3>
              <span className="tag tag-lime">READY</span>
            </div>
            <div className="deck-cards">
              <CardFace card={createCard("triangle", 4)} size="sm" />
              <CardFace card={createCard("cross", 2)} size="sm" />
              <CardFace card={createCard("star", 8)} size="sm" />
              <CardFace card={createCard("circle", 13)} size="sm" />
              <CardFace card={createCard("whot", 20)} size="sm" />
            </div>
            <p className="muted">Circle, triangle, cross, square, star — plus five wild Whot cards. The real 54-card set.</p>
          </div>
        </div>

        <div className="stats-strip">
          <div className="stat-cell"><span className="stat-value">54</span><span className="stat-label">Cards in a set</span></div>
          <div className="stat-cell"><span className="stat-value">5</span><span className="stat-label">Wild Whot cards</span></div>
          <div className="stat-cell"><span className="stat-value"><Users size={27} strokeWidth={3} /></span><span className="stat-label">Up to 5 at a table</span></div>
        </div>
      </section>
    </main>
  );
}
