import Link from 'next/link';
import { ArrowRight, Plus, BookOpen } from "@phosphor-icons/react/dist/ssr";
import { InviteJoin } from '@/components/invite-join';
export function Dashboard() {
 return <main className="page-wrap simple-play">
 <header className="simple-heading"><h1>Ready to play?</h1><p>A table with friends. A quiet round with bots.</p></header>
 <div className="simple-play-grid">
 <section className="simple-surface"><h2>Create a game</h2><p>Choose your players and house rules.</p><Link className="button button-primary" href="/lobby"><Plus size={18}/> Create game</Link></section>
 <section className="simple-surface"><h2>Join friends</h2><p>Enter the code they shared with you.</p><InviteJoin id="home-invite-code"/></section>
 </div>
 <Link className="simple-practice" href="/game"><span><strong>Practice with bots</strong><small>No sign-in · Untimed · 2–4 players</small></span><ArrowRight size={20}/></Link>
 <div className="simple-footer"><Link href="/history">Resume a match →</Link><Link href="/tutorial"><BookOpen size={16}/> How to play</Link></div>
 </main>;
}
