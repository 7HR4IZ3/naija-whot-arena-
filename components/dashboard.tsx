import Link from "next/link";
import { ArrowRight, Plus, Trophy, BookOpen } from "lucide-react";
import { InviteJoin } from "@/components/invite-join";

export function Dashboard() {
  return <main className="page-wrap page-home">
    <section className="home-command">
      <div className="welcome-copy">
        <p className="screen-kicker"><span className="tiny-suits" aria-hidden="true">● ▲ ✚</span> Nigerian Whot, together</p>
        <h1>Bring your people<br /><em>to the table.</em></h1>
        <p>Join a friend, create your own game, or warm up against Amaka. Pick a path and get playing.</p>
        <div className="feature-actions"><Link className="button button-primary" href="/game">Play practice <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/lobby">Create a game <Plus size={16} /></Link></div>
      </div>
      <section className="home-invite-panel" aria-labelledby="home-invite-heading">
        <p className="home-panel-kicker">Play with friends</p>
        <h2 id="home-invite-heading">Create or join a game.</h2>
        <p>Start a table with your own rules, or use a friend&apos;s code to join theirs.</p>
        <Link className="home-create-action" href="/lobby"><span><strong><Plus size={16} /> Create a game</strong><small>Choose players, cards, and mode</small></span><ArrowRight size={17} /></Link>
        <div className="home-join-divider" aria-hidden="true"><span>or join with an invite code</span></div>
        <InviteJoin id="home-invite-code" />
        <small className="home-invite-note">Online tables use your account name automatically. No extra guest-name form.</small>
      </section>
    </section>
    <section className="home-quick-links" aria-label="More ways to play">
      <Link href="/tournaments"><span><Trophy size={18} /><strong>Tournaments</strong></span><small>Play for bragging rights</small><ArrowRight size={16} /></Link>
      <Link href="/rules"><span><BookOpen size={18} /><strong>How to play</strong></span><small>Learn the calls and power cards</small><ArrowRight size={16} /></Link>
    </section>
    <footer className="home-footer"><span>Whot Arena · A place to play together.</span></footer>
  </main>;
}
