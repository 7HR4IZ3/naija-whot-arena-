"use client";
import Link from "next/link";
import { ArrowRight, Users, Trophy } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { CardFace } from "@/components/card-face";
import { createCard } from "@/lib/cards";
import { InviteJoin } from "@/components/invite-join";

export function PlayHub() {
  return <main className="page-wrap page-play">
    <ScreenHeader kicker="Let’s play" title="Your next round starts here." description="A quick warm-up or a table full of friends. You choose." />
    <div className="play-layout">
      <section className="practice-card"><div><span className="eyebrow-pill">No sign-in needed</span><h2>Find your rhythm.</h2><p>Take on Amaka in a relaxed practice match. The perfect place to get your hand back in.</p><Link className="button button-light" href="/game">Play against the computer <ArrowRight size={16} /></Link><small>Local practice · Classic rules · 2 players</small></div><div className="practice-deck" aria-hidden="true"><CardFace card={createCard("triangle", 8)} size="lg" /><CardFace card={createCard("circle", 2)} size="lg" /></div></section>
      <section className="join-card"><span className="path-icon"><Users size={21} /></span><h2>You’re invited.</h2><p>Have a room code? Your people are waiting.</p><InviteJoin id="play-invite-code" /></section>
    </div>
    <div className="play-secondary"><Link href="/lobby" className="horizontal-path"><Users size={24} /><div><h3>Host your own table</h3><p>Your room. Your people. Your house rules.</p></div><ArrowRight size={19} /></Link><Link href="/tournaments" className="horizontal-path"><Trophy size={24} /><div><h3>Make it a tournament</h3><p>Gather a bigger group and play for bragging rights.</p></div><ArrowRight size={19} /></Link></div>
  </main>;
}
