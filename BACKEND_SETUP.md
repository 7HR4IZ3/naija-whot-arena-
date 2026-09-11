# Enable online Whot

The web app uses Supabase Auth, Postgres RPCs, and Realtime. It does not require a service-role key in Vercel.

## Database

Run `supabase/setup.sql` in the Supabase SQL Editor. This combines the base schema and secure arena migration in one transaction and works for a fresh project or the existing base schema. The migration revokes old direct game writes and installs authenticated, transactional actions. Do not rerun the old schema on its own after setup.

Enable the Supabase Cron integration (`pg_cron`), then run `supabase/migrations/20260911_timers.sql`. This advances expired turns even when every player closes the app. Without Cron, an active participant processes expiration; late moves are still rejected by the database. The five-second sweep means unattended transitions can occur up to five seconds after the deadline.

The main migration adds `arena_updates` to `supabase_realtime` when that publication exists. Check it is enabled in your project's Realtime publication. The client also refreshes snapshots every five seconds and when the tab regains focus.

## Vercel

Set these for Production and your intended Preview environments, then redeploy:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://naija-whot-arena.vercel.app
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is supported as an alternative key variable. Never use a service-role/secret key as a public key.

Visit `/setup` or `/api/health`. Success is `ready` with schemaVersion `1`. `migration_required` means the URL/key reached Supabase but the RPC is missing. `connection_failed` can indicate an invalid URL/key, paused project, or unreachable API.

## Authentication

Enable Email sign-in. Set Site URL to `https://naija-whot-arena.vercel.app` and add `https://naija-whot-arena.vercel.app/auth/callback` to allowed redirect URLs. Add the corresponding callback for each preview used for testing. The existing magic-link template should link to `{{ .ConfirmationURL }}`. This implements PKCE; open the email link in the same browser that requested it. An expired or cross-browser link can be replaced by requesting another.

Configure custom SMTP for public email delivery. The default Supabase sender only supports authorized team recipients. Send a real sign-in email and verify the return to `/account`; delivery cannot be confirmed from a public health check.

## Features and rules

- Rooms: 2–5 players; atomic capacity enforcement, all-player ready checks, host-only settings/start, host transfer when leaving a waiting room, rematch lobby.
- Game actions: server shuffle/deal; private hands and deck; validated play/draw/forfeit/timeout; stale version rejection and duplicate-request protection.
- Rules: enabled/disabled action cards, stack/block/no defence, draw-one/until-playable, clockwise/anticlockwise, Whot calls, scoring and target-score knockout series.
- Whot disabled removes the five Whot cards. Last-card calls are automatic announcements. Final action-card effects apply before scoring; an empty hand ends the round.
- If the market is blocked for every active player, lowest hand score wins. Equal hand scores use stable player-ID order, a deterministic tie-break used for bracket progression.
- Tournaments: host-controlled registration/start; random pairs, single elimination, automatic byes, series matches if knockout is selected, next-round creation after all current matches finish, champion.
- Reconnection restores the server snapshot. Turn timers continue while away. Untimed matches wait for a player to return or forfeit.
- Results and leaderboard count completed matches/series, not individual knockout rounds. Byes are not counted as played wins.

## Verification

`npm run lint` and `npm run build` validate the application. Install `@electric-sql/pglite` in a temporary directory, then run:

```
PGLITE_PATH=/absolute/path/to/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-backend.mjs
```

This tests SQL execution, authorization, idempotency, two-to-five-player games, knockout, penalties, deck conservation, timers, and a five-player tournament. It uses a local simulated auth schema, not real accounts. Live SMTP delivery and a two-browser Supabase game still require the actual migration and signed-in users.
