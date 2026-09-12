# Mobile interface

Direction: a quiet, utilitarian card-game interface. The supplied minimalist skill takes priority; taste-skill's redesign and accessibility guidance informs the implementation. Marketing-only requirements (large hero images, decorative motion and oversized section spacing) do not apply to these game and form screens.

## Foundation

- Warm white canvas, white surfaces, charcoal actions, green reserved for game state and focus. Card artwork retains its original colours.
- System-native sans-serif typography. Body 15px, input text 16px, helper text 13px. No downloaded font required.
- Buttons and inputs use 6px corners; panels and dialogs 10–12px. Dividers group settings without nested boxes or shadows.
- Phosphor icons throughout the application navigation and controls; bold navigation icons and labelled destinations.
- Main breakpoints at 374px and 768px. Content stays constrained on desktop and uses 16–20px side gutters on phones.
- Touch controls at least 44px tall; focus indicators, native inputs, native disclosure elements and native modal dialogs remain available. Selected cards expose pressed state.
- Motion communicates card movement and selection. No decorative page-entry animation or perpetual UI pulsing.

## Page treatment

- Play: create and join remain the primary choices, followed by practice and supporting links. Invite codes have a full-width flexible field.
- Practice: opponents, difficulty, Start, then optional house rules and saved setups. Untimed practice does not offer a timer it cannot honour.
- Create table/event: clear field labels, compact collapsed house rules, full-width submission action.
- Waiting room: wrapping roster names, clear readiness, shareable code and compact rules.
- Game: compact toolbar, stable requested-symbol chip, larger cards, restrained playable outlines, stronger selected state, direct market action and accessible fallback play button.
- History/profile: readable rows and metadata, wrapping names, touch-sized rejoin/result actions, properly grouped profile form.
- Tournaments: flat filter tabs and event rows, horizontal bracket scrolling stays local to the bracket.
- Authentication: consistent field sizing, visible password controls and one primary action.
- Rules/tutorial: readable reference text, horizontally scrollable section navigation and tables, consistent learning controls.
- Setup and empty/error states inherit the same typography, surfaces and actions.

## Implementation

`app/mobile-minimal.css` contains the shared design system. Selectors are scoped to `body.minimal-ui` so route stylesheet load order cannot restore older visual treatments. Existing rules still supply card artwork and animation mechanics. Broad practice label styling was removed at its source.

Existing online-feature migration requirements are unchanged. Publishing UI does not activate pending Supabase migrations. Do not claim physical-device verification from a desktop browser session.
