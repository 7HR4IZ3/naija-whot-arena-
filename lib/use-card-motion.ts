"use client";
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Card } from '@/lib/cards';

type MotionSnapshot = { key: string; top: Card; actor?: string; players: { id: string; count: number; cards?: Card[] }[] };
type Flight = { from: HTMLElement; to: HTMLElement; card?: Card };

// Shared by practice and online games. Coordinates come from the actual mobile/desktop layout.
export function useCardMotion(snapshot: MotionSnapshot | null, root: RefObject<HTMLElement | null>) {
 const previous = useRef<MotionSnapshot | null>(null);
 const animations = useRef(new Set<Animation>());
 const generation = useRef(0);
 const [moving, setMoving] = useState(false);
 const serialized = JSON.stringify(snapshot);
 useEffect(() => {
  const next = JSON.parse(serialized) as MotionSnapshot | null;
  if (!next || !root.current) return;
  const old = previous.current;
  previous.current = next;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes = Array.from(root.current.querySelectorAll<HTMLElement>('[data-player]'));
  const node = (id: string) => nodes.find(n => n.dataset.player === id);
  const market = root.current.querySelector<HTMLElement>('[data-market]');
  const discard = root.current.querySelector<HTMLElement>('[data-discard]');
  const flights: Flight[] = [];
  const deal = !old || old.key !== next.key;
  if (!deal && old.top.id !== next.top.id && discard) {
   const actor = next.actor || old.players.find(p => p.cards?.some(c => c.id === next.top.id))?.id;
   const from = actor ? node(actor) : null;
   if (from) flights.push({ from, to: discard, card: next.top });
  }
  for (const player of next.players) {
   const before = deal ? null : old.players.find(p => p.id === player.id);
   const amount = deal ? player.count : Math.max(0, player.count - (before?.count || 0));
   const to = node(player.id);
   if (market && to) for (let i = 0; i < Math.min(amount, 12); i++) flights.push({ from: market, to });
  }
  if (!flights.length) return;
  const run = ++generation.current;
  for (const animation of animations.current) animation.cancel();
  const move = async () => {
   setMoving(true);
   // Suspended or interrupted animations must never hold the player's controls.
   let expired = false;
   const watchdog = setTimeout(() => { expired = true; for (const animation of animations.current) animation.cancel(); }, 4000);
   try {
    for (const flight of flights) {
     if (expired || run !== generation.current) break;
     const a = flight.from.getBoundingClientRect(); const b = flight.to.getBoundingClientRect();
     const width = innerWidth < 600 ? 58 : 70; const height = width * 1.5;
     const img = document.createElement('img');
     img.src = flight.card ? `/cards/classic/${flight.card.suit}-${flight.card.value}.svg` : '/cards/classic/back.svg';
     img.alt = ''; img.className = 'arena-flying-card';
     Object.assign(img.style, { width: `${width}px`, height: `${height}px`, left: `${a.left+a.width/2-width/2}px`, top: `${a.top+a.height/2-height/2}px` });
     document.body.append(img);
     const animation = img.animate([{ transform: 'translate(0,0) rotate(-7deg)' }, { transform: `translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) rotate(0)` }], { duration: deal ? 85 : flights.length > 1 ? 160 : 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
     animations.current.add(animation);
     try { await animation.finished; } catch {} finally { animations.current.delete(animation); img.remove(); }
    }
   } finally { clearTimeout(watchdog); if (run === generation.current) setMoving(false); }
  };
  void move();
 }, [serialized, root]);
 useEffect(() => {
  const running = animations.current; const version = generation;
  return () => { version.current++; for (const animation of running) animation.cancel(); };
 }, []);
 return moving;
}
