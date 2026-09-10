import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { ScreenHeader } from "@/components/screen-header";
import { createCard } from "@/lib/cards";
import { MOCK_ROOMS } from "@/lib/mock-data";

function roomPath(name: string) {
  return `/table/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function Dashboard() {
  return (
    <main className="page-wrap page-home">
      <div className="topline">
        <span>WHOT ARENA / HOME</span>
        <strong>3 TABLES OPEN</strong>
      </div>

      <ScreenHeader
        action={<Link className="button button-primary" href="/lobby">Create a table</Link>}
        description="Start a quick game, create a private room, or find an open seat with people already playing."
        kicker="Tuesday, 10 September"
        title="Pick a table."
      />

      <section className="home-grid" aria-label="Play options">
        <article className="panel feature-panel">
          <p className="screen-kicker">Quick match</p>
          <h2>Find your next round.</h2>
          <p>Join a table with the classic rules, or set up the exact way your crew plays at home.</p>
          <div className="feature-actions">
            <Link className="button button-primary" href="/play"><Play size={15} fill="currentColor" /> Find a game</Link>
            <Link className="button button-secondary" href="/lobby">Join with code</Link>
          </div>
          <div className="hero-cards" aria-label="Whot cards">
            <CardFace card={createCard("circle", 8)} className="hero-card" size="sm" />
            <CardFace card={createCard("star", 5)} className="hero-card" size="sm" />
            <CardFace card={createCard("whot", 20)} className="hero-card" size="sm" />
          </div>
        </article>

        <article className="panel list-panel">
          <div className="panel-heading">
            <h2>Open rooms</h2>
            <Link className="text-link" href="/play">View all</Link>
          </div>
          <div className="room-list">
            {MOCK_ROOMS.map((room) => (
              <div className="room-row" key={room.name}>
                <div>
                  <p className="room-name">{room.name}</p>
                  <p className="room-meta">{room.tags.join(" · ")}</p>
                </div>
                <span className="room-count">{room.players} / {room.maxPlayers}</span>
                <Link className="text-link" href={roomPath(room.name)}>Join</Link>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="home-footnote" aria-label="Whot Arena highlights">
        <article className="panel mini-note">
          <p><strong>Your table, your house rules.</strong><br />Choose which action cards are active, whether draws stack, and how the winner is decided.</p>
          <Link className="text-link" href="/lobby">Set up a table <ArrowRight size={13} /></Link>
        </article>
        <article className="panel mini-note">
          <p><strong>54 cards</strong><br />Five shapes, five Whot cards, one familiar table.</p>
          <Link className="text-link" href="/rules">Learn the deck <ArrowRight size={13} /></Link>
        </article>
      </section>
    </main>
  );
}
