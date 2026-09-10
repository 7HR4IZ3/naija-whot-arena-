import Link from "next/link";
import { ArrowRight, Users, Trophy, BookOpen } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { createCard } from "@/lib/cards";

export function Dashboard() {
  return <main className="page-wrap page-home">
    <section className="welcome-hero">
      <div className="welcome-copy">
        <p className="screen-kicker"><span className="tiny-suits" aria-hidden="true">● ▲ ✚</span> A familiar game. A fresh table.</p>
        <h1>A little friendly<br /><em>competition.</em></h1>
        <p>Your favourite Nigerian card game, with room for everyone. Bring your people. Make the rules. Play one more round.</p>
        <div className="feature-actions"><Link className="button button-primary" href="/game">Play a practice round <ArrowRight size={17} /></Link><Link className="text-link" href="/play">Ways to play</Link></div>
        <span className="hero-caption">54 cards. Five shapes. Endless “one last game”.</span>
      </div>
      <div className="deck-scene" aria-label="Classic burgundy Whot playing cards">
        <div className="scene-ring" /><span className="scene-label">THE ORIGINAL KIND OF FUN</span>
        <div className="display-deck"><CardFace card={createCard("circle", 2)} size="lg" /><CardFace card={createCard("whot", 20)} size="lg" /><CardFace card={createCard("star", 5)} size="lg" /></div>
        <span className="scene-bottom">Made for the way we play.</span>
      </div>
    </section>
    <section className="home-paths" aria-labelledby="your-table-heading">
      <div className="section-heading"><div><p className="screen-kicker">Make yourself at home</p><h2 id="your-table-heading">There’s a seat for you.</h2></div><span className="muted">Choose your kind of game</span></div>
      <div className="path-grid">
        <Link className="path-card" href="/lobby"><span className="path-icon"><Users size={22} /></span><h3>Play with your people</h3><p>Create a room, choose the house rules, and send an invite code.</p><span className="path-cta">Create a table <ArrowRight size={16} /></span></Link>
        <Link className="path-card" href="/tournaments"><span className="path-icon rose"><Trophy size={22} /></span><h3>A little more at stake</h3><p>Bring the whole crew together for a friendly tournament.</p><span className="path-cta">Explore tournaments <ArrowRight size={16} /></span></Link>
        <Link className="path-card" href="/rules"><span className="path-icon sand"><BookOpen size={22} /></span><h3>Rusty? No wahala.</h3><p>Meet the deck and brush up on the calls before your first deal.</p><span className="path-cta">Learn to play <ArrowRight size={16} /></span></Link>
      </div>
    </section>
    <footer className="home-footer"><span>Whot Arena · A place to play together.</span><span>Circle. Triangle. Cross. Square. Star.</span></footer>
  </main>;
}
