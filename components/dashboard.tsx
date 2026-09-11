import Link from "next/link";
import { ArrowRight, Users, Trophy, BookOpen } from "lucide-react";
import { InviteJoin } from "@/components/invite-join";

export function Dashboard() {
  return <main className="page-wrap page-home">
    <section className="home-command">
      <div className="welcome-copy">
        <p className="screen-kicker"><span className="tiny-suits" aria-hidden="true">● ▲ ✚</span> Nigerian Whot, together</p>
        <h1>Bring your people<br /><em>to the table.</em></h1>
        <p>Join a friend, host your own room, or warm up against Amaka. Pick a path and get playing.</p>
        <div className="feature-actions"><Link className="button button-primary" href="/game">Play practice <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/lobby">Host a table <Users size={16} /></Link></div>
      </div>
      <section className="home-invite-panel" aria-labelledby="home-invite-heading">
        <p className="home-panel-kicker">Join a table</p>
        <h2 id="home-invite-heading">Have an invite code?</h2>
        <p>Paste the code from your host and go straight to the waiting room.</p>
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
