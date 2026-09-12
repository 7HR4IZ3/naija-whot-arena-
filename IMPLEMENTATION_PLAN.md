# Match experience release

1. Reconnection: refresh on network return, tab visibility and focus; retain the last snapshot, block moves while disconnected, prevent overlapping reads, reconcile uncertain writes without replaying them.
2. Card gestures: upward touch drag, sideways hand scrolling, mouse dragging, cancellation and tap/keyboard fallback. Revalidate before submitting.
3. History: fix SQL identifier conflicts, keep active seats accessible, distinguish failed loads from empty lists.
4. Rematches: open the existing table from results, preserve players/rules, reset readiness and let the host start after confirmation.
5. Recent moves: persistent server log of public move messages, including missed events; expandable UI.
6. Results: archive completed-round hands and totals, expose only after round completion, explain winner/elimination and ties.
7. Saved rules: device-local named presets, load/delete, validate against the selected seat count.
8. Practice: 1–3 opponents and easy/standard/hard decisions based only on each bot's own hand and public state.
9. Reactions: fixed messages for private tables, membership checks, server cooldown, mute option; no free text.
10. Turn alerts: explicit opt-in browser notifications while a game tab remains open, only on transition to the user's turn; permission and unsupported-browser feedback.
11. Tutorial: interactive matching, Whot symbol selection and penalty lessons; replayable from Play.
12. Statistics: personal all-time played/won counts and mode breakdown, separate from practice and from the limited result list.

Validation: lint/build; targeted gesture checks; backend authorization/history/log/reaction tests; practice deck conservation and completion. Publish the completed source and verify Vercel deployment. Live SQL activation requires configured database administration access; never claim it applied based on a successful frontend deploy.

## Verification and activation

- ESLint and Next.js production build passed.
- Backend suite passed: complete games, history, private-hand isolation, stale moves, replay safety, reaction authorization/cooldown, completed-round snapshots, statistics and rematch readiness. Consolidated setup plus reapplying the migration also passed.
- Practice suite exercised 54 combinations of seat counts, difficulty, game modes and market rules. Score-mode games completed; recycle-mode games were checked for legal moves and conservation, since legal recycling can repeat indefinitely.
- Browser access to the local server was blocked. Physical iOS/Android drag and horizontal-scroll checks still need real-device verification.
- Apply `supabase/migrations/20260912_match_experience.sql` in the existing Supabase project's SQL editor after the existing 20260911 migrations. This is additive and safe to reapply; do not reset the database.
- No database administration connection is available in this session. Production promotion is held pending migration activation and hosted browser verification.
- Notification delivery requires a supporting browser and an open game tab; these are not background push notifications. Presets are stored on the current device.
