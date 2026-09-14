"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowSquareOut as ExternalLink, Info } from "@phosphor-icons/react/dist/ssr";
import { CardFace } from "@/components/card-face";
import { ScreenHeader } from "@/components/screen-header";
import { ACTIONS, buildDeck, CARD_MANIFEST, SUIT_META, SUITS } from "@/lib/cards";

const sections = ["Core rules", "The deck", "Power cards", "Modes", "House rules", "Sources"] as const;
type Section = (typeof sections)[number];

export function RulesLibrary() {
  const [active, setActive] = useState<Section>("Core rules");
  const deck = useMemo(() => buildDeck(), []);

  return (
    <main className="page-wrap page-rules">
      <div className="topline">
        <span>WHOT ARENA / RULES</span>
        <strong>THE HOUSE RULES LIBRARY</strong>
      </div>
      <ScreenHeader
        action={<Link className="button button-secondary" href="/play">Back to play</Link>}
        description="Match the number or symbol. Empty your hand to win."
        kicker="How to play"
        title="How to play"
      />

      <div className="rules-layout">
        <nav className="rules-index" aria-label="Rules sections">
          {sections.map((section) => (
            <button aria-pressed={active === section} className={active === section ? "active" : ""} key={section} onClick={() => setActive(section)} type="button">{section}</button>
          ))}
        </nav>

        <section className="panel rules-content-panel">
          <div className="rules-content">
            {active === "Core rules" && <CoreRules />}
            {active === "The deck" && <DeckRules deck={deck} />}
            {active === "Power cards" && <PowerCards />}
            {active === "Modes" && <Modes />}
            {active === "House rules" && <HouseRules />}
            {active === "Sources" && <Sources />}
          </div>
        </section>
      </div>
    </main>
  );
}

function CoreRules() {
  return (
    <>
      <h2>How a round works</h2>
      <p>Deal six cards to each player. Turn one card face up to start the discard pile. The player to the dealer&apos;s right usually begins, then play moves clockwise.</p>
      <div className="rules-section">
        <h3>Turn sequence</h3>
        <ol style={{ display: "grid", gap: 12, margin: 0, paddingLeft: 23, color: "#403d37", fontSize: 14, fontWeight: 700, lineHeight: 1.55 }}>
          <li><strong>Match.</strong> Play a card with the same symbol or number as the top discard.</li>
          <li><strong>Use Whot.</strong> A Whot / Crown card is wild. Name the symbol the next player must follow.</li>
          <li><strong>Draw.</strong> If you cannot play, draw one card from the market and pass. Some tables allow you to play it immediately if it fits.</li>
          <li><strong>Resolve power.</strong> Hold On, Pick Two, Pick Three, Suspension, and General Market change the next turn.</li>
          <li><strong>Call your finish.</strong> Many tables require a player to call “semi-last” with two cards and “last card” with one. Agree this before dealing.</li>
        </ol>
      </div>
      <div className="rules-section">
        <h3>Winning a round</h3>
        <p>The round ends when a player gets rid of every card. For a score match, add the remaining cards in opponents&apos; hands; star cards commonly count double, and a Whot card counts 20.</p>
        <div className="rules-callout"><strong>Important:</strong> there is no single worldwide Nigerian rulebook. The match lobby should show the exact house rules before anybody joins.</div>
      </div>
    </>
  );
}

function DeckRules({ deck }: { deck: ReturnType<typeof buildDeck> }) {
  return (
    <>
      <h2>The 54-card deck</h2>
      <p>The standard Nigerian Whot set has five suits plus five Whot / Crown wild cards. The exact card count matters because it controls the market, the odds, and the feel of a long table.</p>
      <div className="rules-section">
        <h3>Card manifest</h3>
        <table className="deck-table">
          <thead><tr><th>Suit</th><th>Cards</th><th>Count</th><th>Visual meaning</th></tr></thead>
          <tbody>
            {SUITS.map((suit) => <tr key={suit}><td>{SUIT_META[suit].label}</td><td>{CARD_MANIFEST[suit].join(", ")}</td><td>{CARD_MANIFEST[suit].length}</td><td>{SUIT_META[suit].short} shape in traditional burgundy</td></tr>)}
            <tr><td>Whot / Crown</td><td>20 × 5</td><td>5</td><td>Wild; choose the next symbol</td></tr>
          </tbody>
        </table>
      </div>
      <div className="rules-section">
        <h3>Every card asset</h3>
        <div className="card-gallery" aria-label="All 54 cards in the standard deck">
          {deck.map((card) => <CardFace card={card} key={card.id} size="sm" />)}
        </div>
        <p className="form-helper" style={{ marginTop: 15 }}>Original SVG faces inspired by physical Nigerian Whot cards. Mirrored corner symbols stay readable in a hand; the number inside each star shows its doubled score. <a className="text-link" href="/cards/classic/whot-20.svg" download>Download a sample SVG</a></p>
      </div>
      <div className="rules-section">
        <h3>Scoring reference</h3>
        <table className="variant-table">
          <thead><tr><th>Card</th><th>Common value</th><th>Use</th></tr></thead>
          <tbody>
            <tr><td>Number cards</td><td>Printed number</td><td>Usually added to a loser&apos;s hand at round end.</td></tr>
            <tr><td>Star cards</td><td>Double printed number</td><td>Often the high-value suit; some tables treat the star as a special action instead.</td></tr>
            <tr><td>Whot / Crown</td><td>20</td><td>Wild card and commonly the largest penalty.</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function PowerCards() {
  return (
    <>
      <h2>Power cards</h2>
      <p>These actions are widely recognised, but the exact stacking and defence rules vary by table. Arena exposes them as switches when a host creates a room.</p>
      <div className="rules-section">
        <h3>Common actions</h3>
        <table className="action-table">
          <thead><tr><th>Card</th><th>Name</th><th>Common effect</th><th>Typical defence</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>{ACTIONS[1].name}</td><td>The same player takes another turn.</td><td>Usually none.</td></tr>
            <tr><td>2</td><td>{ACTIONS[2].name}</td><td>Next player draws two cards.</td><td>Play another 2 to stack the penalty.</td></tr>
            <tr><td>5</td><td>{ACTIONS[5].name}</td><td>Next player draws three cards.</td><td>Play another 5 to stack the penalty.</td></tr>
            <tr><td>8</td><td>{ACTIONS[8].name}</td><td>Next player loses their turn.</td><td>Some tables allow an 8 to defend or extend the suspension.</td></tr>
            <tr><td>14</td><td>{ACTIONS[14].name}</td><td>Every other player draws one card.</td><td>Often no defence; house rule decides whether it can be chained.</td></tr>
            <tr><td>20</td><td>{ACTIONS[20].name}</td><td>Wild card. The player calls circle, triangle, cross, square, or star.</td><td>The next card must match the called symbol or be another Whot.</td></tr>
          </tbody>
        </table>
      </div>
      <div className="rules-section">
        <h3>Stacking example</h3>
        <div className="rules-callout"><strong>2 → 2 → 2:</strong> the next player faces a six-card Pick Two penalty, unless they can continue the stack. <strong>5 → 5:</strong> the next player faces six cards. Hosts can turn stacking off for a simpler match.</div>
      </div>
    </>
  );
}

function Modes() {
  return (
    <>
      <h2>Ways to play</h2>
      <p>Start with the classic round, then use a mode that matches the room. The platform keeps the rules visible so “we usually play it this way” is never a surprise mid-game.</p>
      <div className="rules-section">
        <h3>Platform modes</h3>
        <table className="variant-table">
          <thead><tr><th>Mode</th><th>Players</th><th>What happens</th></tr></thead>
          <tbody>
            <tr><td>Quick match</td><td>2–8</td><td>Jump into a live table, using the platform&apos;s default classic settings.</td></tr>
            <tr><td>Private table</td><td>2–8</td><td>Host sets seats, hand size, and house rules, shares a code, waits for players, then starts.</td></tr>
            <tr><td>Tournament</td><td>8–64</td><td>Players register before the start time; the host closes registration and runs elimination rounds.</td></tr>
            <tr><td>Knockout league</td><td>Any bracket</td><td>Play normal rounds; after each win, count every active hand and eliminate the player with the highest total.</td></tr>
            <tr><td>Tender</td><td>2–8</td><td>When the market is exhausted, count active hands, eliminate the lowest total, and deal the remaining players again until one remains.</td></tr>
            <tr><td>Star / advanced</td><td>2–5</td><td>Optional table preset with star doubling, finish calls, and stricter turn timers.</td></tr>
          </tbody>
        </table>
      </div>
      <div className="rules-section">
        <h3>Tournament flow</h3>
        <ol style={{ display: "grid", gap: 10, margin: 0, paddingLeft: 23, color: "#403d37", fontSize: 13, fontWeight: 700, lineHeight: 1.55 }}>
          <li>Host publishes the event and a maximum player cap.</li>
          <li>Players join during registration and can inspect the rules.</li>
          <li>At start, the roster locks and the platform seeds the first bracket.</li>
          <li>Winners advance; standings and eliminated players stay visible.</li>
        </ol>
      </div>
    </>
  );
}

function HouseRules() {
  return (
    <>
      <h2>Agree before dealing</h2>
      <p>These are common variations reported across Whot apps, guides, and family tables. They are all valid ways to play; they should not be silently mixed.</p>
      <div className="rules-section">
        <h3>Variant checklist</h3>
        <table className="variant-table">
          <thead><tr><th>Rule switch</th><th>Option A</th><th>Option B / variation</th></tr></thead>
          <tbody>
            <tr><td>Opening hand</td><td>Six cards</td><td>Choose 3–12 cards; the table validates the size against the number of seats and deck.</td></tr>
            <tr><td>Drawing</td><td>Draw one and pass</td><td>Draw until playable, or draw one and immediately play if legal.</td></tr>
            <tr><td>2 / 5 penalties</td><td>Stack identical power cards</td><td>No stacking; penalty resolves immediately.</td></tr>
            <tr><td>Whot call</td><td>Whot chooses the next symbol</td><td>Whot acts as a normal 20, or can be used as a defence.</td></tr>
            <tr><td>Direction</td><td>Clockwise</td><td>Some tables use a reverse card or allow a direction change on a special.</td></tr>
            <tr><td>End calls</td><td>“Semi-last” and “last card” required</td><td>No calls; the interface can still show two-card and one-card alerts.</td></tr>
            <tr><td>Timer</td><td>10 seconds</td><td>15–30 seconds, or untimed casual play.</td></tr>
            <tr><td>Deck size</td><td>One 54-card deck</td><td>Two decks for large rooms or longer games.</td></tr>
            <tr><td>Market exhaustion</td><td>Count points; the highest hand total loses</td><td>Recycle the pot: keep the facing card and shuffle everything underneath into the market. Tender still eliminates the lowest total when scoring is selected.</td></tr>
          </tbody>
        </table>
      </div>
      <div className="rules-callout"><Info size={15} style={{ verticalAlign: "-3px", marginRight: 5 }} /><strong>Recommended Arena default:</strong> six cards, draw one and pass, stack 2s and 5s, Whot calls a suit, 10-second timer, and first empty hand wins the round.</div>
    </>
  );
}

function Sources() {
  const sources = [
    ["Pagat · Whot! rules", "Reference rules, card distribution, actions, scoring", "https://www.pagat.com/com/whot.html"],
    ["Wikipedia · Whot!", "Deck overview and history context", "https://en.wikipedia.org/wiki/Whot%21"],
    ["World of Playing Cards · Whot", "Historic Waddingtons deck context", "https://www.wopc.co.uk/uk/waddingtons/whot/"],
    ["Whot King · Maliyo Games", "Modern multiplayer mode inspiration", "https://play.google.com/store/apps/details?id=com.maliyo.whotking"],
    ["Naija Whot · App Store", "Mobile rules and feature reference", "https://apps.apple.com/ng/app/naija-whot/id1493269750"],
    ["Whot.online", "Online play and rules reference", "https://www.whot.online/"],
    ["Wikimedia Commons · Whot", "Public card-art reference category", "https://commons.wikimedia.org/wiki/Category:Whot%21"],
    ["mykeels/whot-cards · GitHub", "Earlier deck artwork reference; retained in the source archive", "https://github.com/mykeels/whot-cards"],
  ];

  return (
    <>
      <h2>References &amp; provenance</h2>
      <p>The core deck and action descriptions are consolidated from the references below. Because house rules vary, the app labels configurable rules as variants instead of presenting them as universal law.</p>
      <div className="rules-section">
        <h3>Read the references</h3>
        <div className="source-list">
          {sources.map(([title, description, href]) => (
            <a className="source-link" href={href} key={href} rel="noreferrer" target="_blank">
              <span><strong>{title}</strong><br /><span className="muted">{description}</span></span>
              <ExternalLink size={15} />
            </a>
          ))}
        </div>
      </div>
      <div className="rules-callout"><strong>Card assets:</strong> the Arena cards are original CSS/vector-style renderings based on the documented suit names and numbers; no third-party card image file is required for the game to work.</div>
    </>
  );
}
