# Whot Arena

Neo-brutalist online Nigerian Whot platform built with Next.js, Supabase, and Vercel.

Repository: `7HR4IZ3/naija-whot-arena-`

## What is included

- Quick-match local playable demo with a real 54-card deck, turn actions, Whot suit calling, penalties, and score-aware card values.
- Private table flow with a six-character room code, player roster, ready states, host start, and Supabase Realtime hooks.
- Tournament creation and registration flow with public rules, player caps, waiting roster, and host start.
- Rules library covering the core turn loop, card manifest, action cards, scoring, tournament flow, and common house-rule variants.
- Original CSS-rendered card faces for every card in the standard deck. The same manifest powers the card gallery and game engine.
- Demo-first behavior: the UI works without environment variables; Supabase enables auth, room persistence, and realtime when configured.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase variables, use `/game` for the local game loop and explore the preview lobbies. For synced rooms and magic-link auth, add the public Supabase URL and anon key to `.env.local`.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Enable Realtime for `rooms`, `room_players`, and `tournament_players`.
4. Add these values to `.env.local` and to the Vercel project environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

The schema includes profiles, rooms, room players, tournaments, tournament players, matches, match players, match events, indexes, triggers, and row-level security policies.

## Deploy

The app is designed for Vercel with the Next.js App Router. Import `7HR4IZ3/naija-whot-arena-` into Vercel, set the three environment variables above, and deploy. Every GitHub push can then create a preview deployment.

## Whot rules used by the default preset

The standard deck is 54 cards: 12 circles, 12 triangles, 9 crosses, 9 squares, 7 stars, and five Whot/Crown 20 cards. Players normally receive six cards, match the discard by number or symbol, draw one when stuck, and play clockwise. Common actions are 1 Hold On, 2 Pick Two, 5 Pick Three, 8 Suspension, 14 General Market, and 20 Whot/Crown wild. Star cards commonly score double and Whot commonly scores 20.

Nigerian Whot has meaningful house-rule variation, so the product exposes stacking, timer, knockout, drawing, opening hand, finish calls, and Whot behavior as configurable rules rather than hiding them in the engine.

Research references:

- [Pagat · Whot!](https://www.pagat.com/com/whot.html)
- [Wikipedia · Whot!](https://en.wikipedia.org/wiki/Whot%21)
- [World of Playing Cards · Whot](https://www.wopc.co.uk/uk/waddingtons/whot/)
- [Whot King · Maliyo Games](https://play.google.com/store/apps/details?id=com.maliyo.whotking)
- [Naija Whot · App Store](https://apps.apple.com/ng/app/naija-whot/id1493269750)
- [Whot.online](https://www.whot.online/)
- [Wikimedia Commons · Whot!](https://commons.wikimedia.org/wiki/Category:Whot%21)
