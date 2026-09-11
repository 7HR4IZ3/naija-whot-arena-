import Link from "next/link";
import { ArrowRight, Users, Trophy, BookOpen } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { createCard } from "@/lib/cards";
import { InviteJoin } from "@/components/invite-join";

export function Dashboard() {
  return <main className="page-wrap page-home">
    <section className="welcome-hero">
      <div className="welcome-copy">
        <p className="screen-kicker"><span className="tiny-suits" aria-hidden="true">● ▲ ✚</span> Nigerian Whot, together</p>
        <h1>Play a round.<br /><em>Stay for another.</em></h1>
        <p>Start practising, host a table, or enter an invite code and join your people straight away.</p>
        <div className="feature-actions"><Link className="button button-primary" href="/game">Play practice <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/lobby">Host a table <Users size={16} /></Link></div>
        <div className="home-invite"><div><strong>Have an invite?</strong><span>Enter the code from your host.</span></div><InviteJoin id="home-invite-code" compact /></div>
      </div>
      <div className="deck-scene" aria-label="Classic Whot playing cards"><div className="scene-ring" /><span className="scene-label">THE TABLE IS OPEN</span><div className="display-deck"><CardFace card={createCard("whot", 20)} size="lg" /><CardFace card={createCard("circle", 4)} size="lg" /></div><span className="scene-bottom">Bring your people.</span></div>
    </section>
    <section className="home-paths" aria-labelledby="your-table-heading">
      <div className="section-heading"><div><p className="screen-kicker">Keep playing</p><h2 id="your-table-heading">Choose your next table.</h2></div></div>
      <div className="path-grid compact">
        <Link className="path-card" href="/tournaments"><span className="path-icon rose"><Trophy size={22} /></span><h3>Enter a tournament</h3><p>Register early, meet the bracket, and play for bragging rights.</p><span className="path-cta">Explore tournaments <ArrowRight size={16} /></span></Link>
        <Link className="path-card" href="/rules"><span className="path-icon sand"><BookOpen size={22} /></span><h3>Learn the calls</h3><p>See the cards, action rules, and the house settings before you deal.</p><span className="path-cta">Open the rulebook <ArrowRight size={16} /></span></Link>
      </div>
    </section>
    <footer className="home-footer"><span>Whot Arena · A place to play together.</span></footer>
  </main>;
}
