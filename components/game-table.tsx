"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, CircleHelp, RotateCcw } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { ACTIONS, buildDeck, createCard, isPlayable, shuffle, SUIT_META, SUITS, type Card, type PlayingSuit } from "@/lib/cards";

type Turn = "player" | "opponent";

type GameState = {
  hand: Card[];
  opponentHand: Card[];
  market: Card[];
  discard: Card[];
  calledSuit: PlayingSuit | null;
  penaltyType: 2 | 5 | null;
  pendingPenalty: number;
  turn: Turn;
  awaitingSuit: boolean;
  message: string;
  winner: string | null;
};

function freshGame(): GameState {
  const opening = createCard("circle", 4);
  const remaining = shuffle(buildDeck().filter((card) => card.id !== opening.id));
  return {
    hand: remaining.slice(0, 6),
    opponentHand: remaining.slice(6, 12),
    market: remaining.slice(12),
    discard: [opening],
    calledSuit: null,
    penaltyType: null,
    pendingPenalty: 0,
    turn: "player",
    awaitingSuit: false,
    message: "Your turn. Match the 4 of Balls, or play a Whot.",
    winner: null,
  };
}

function drawCards(market: Card[], count: number) {
  const nextMarket = [...market];
  const drawn: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    const card = nextMarket.pop();
    if (!card) break;
    drawn.push(card);
  }
  return { drawn, market: nextMarket };
}

function topCard(game: GameState) {
  return game.discard[game.discard.length - 1];
}

function canPlay(game: GameState, card: Card) {
  if (game.pendingPenalty > 0) return card.value === game.penaltyType;
  return isPlayable(card, topCard(game), game.calledSuit);
}

function pickCalledSuit(hand: Card[]): PlayingSuit {
  const counts = SUITS.map((suit) => ({ suit, count: hand.filter((card) => card.suit === suit).length }));
  return counts.sort((a, b) => b.count - a.count)[0]?.suit ?? "circle";
}

export function GameTable() {
  const [game, setGame] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setGame(freshGame()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!game || game.turn !== "opponent" || game.awaitingSuit || game.winner) return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (!current || current.turn !== "opponent" || current.winner) return current;
        const cardIndex = current.opponentHand.findIndex((card) => canPlay(current, card));
        if (cardIndex === -1) {
          const count = current.pendingPenalty || 1;
          const result = drawCards(current.market, count);
          return {
            ...current,
            opponentHand: [...current.opponentHand, ...result.drawn],
            market: result.market,
            pendingPenalty: 0,
            penaltyType: null,
            calledSuit: null,
            turn: "player",
            message: `Amaka picked up ${result.drawn.length || count}. Your turn.`,
          };
        }

        const card = current.opponentHand[cardIndex];
        const opponentHand = current.opponentHand.filter((_, index) => index !== cardIndex);
        const discard = [...current.discard, card];
        if (opponentHand.length === 0) {
          return { ...current, opponentHand, discard, winner: "Amaka", message: "Amaka emptied their hand first." };
        }
        const calledSuit = card.suit === "whot" ? pickCalledSuit(opponentHand) : null;
        const penaltyType = card.value === 2 || card.value === 5 ? card.value : null;
        const pendingPenalty = penaltyType ? current.pendingPenalty + card.value : 0;
        const nextTurn: Turn = card.value === 1 || card.value === 8 ? "opponent" : "player";
        return {
          ...current,
          opponentHand,
          discard,
          calledSuit,
          penaltyType,
          pendingPenalty,
          turn: nextTurn,
          message: card.suit === "whot" ? `Amaka played Whot and called ${SUIT_META[calledSuit ?? "circle"].short}.` : `Amaka played ${card.value} ${SUIT_META[card.suit].short}.`,
        };
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [game]);

  if (!game) {
    return <main className="game-page"><div className="auth-wrap"><div className="auth-card"><h1>Dealing…</h1><p>Shuffling the 54-card deck.</p></div></div></main>;
  }

  const playCard = (index: number) => {
    if (game.winner) return;
    if (game.turn !== "player") {
      setGame((current) => current ? { ...current, message: "Hold up — Amaka is playing." } : current);
      return;
    }
    if (game.awaitingSuit) return;
    const card = game.hand[index];
    if (!card || !canPlay(game, card)) {
      setSelected(index);
      setGame((current) => current ? { ...current, message: game.pendingPenalty ? `Defend with a ${game.penaltyType}, or pick up ${game.pendingPenalty}.` : "That card does not match the number or symbol on top." } : current);
      return;
    }

    setSelected(null);
    setGame((current) => {
      if (!current) return current;
      const hand = current.hand.filter((_, cardIndex) => cardIndex !== index);
      const discard = [...current.discard, card];
      if (hand.length === 0) return { ...current, hand, discard, winner: "You", message: "You emptied your hand. Round won!" };
      if (card.suit === "whot") {
        return { ...current, hand, discard, calledSuit: null, awaitingSuit: true, pendingPenalty: 0, penaltyType: null, message: "Whot! Choose the symbol for the next turn." };
      }
      const penaltyType = card.value === 2 || card.value === 5 ? card.value : null;
      const pendingPenalty = penaltyType ? current.pendingPenalty + card.value : 0;
      const message = card.value === 1 ? "Hold On — you go again." : card.value === 8 ? "Suspension — Amaka loses their turn." : card.value === 14 ? "General Market — Amaka picks one." : penaltyType ? `${ACTIONS[card.value as 2 | 5].name}! Amaka must defend or pick up ${pendingPenalty}.` : `You played ${card.value} ${SUIT_META[card.suit].short}.`;
      const marketResult = card.value === 14 ? drawCards(current.market, 1) : { drawn: [], market: current.market };
      return {
        ...current,
        hand,
        opponentHand: marketResult.drawn.length ? [...current.opponentHand, ...marketResult.drawn] : current.opponentHand,
        market: marketResult.market,
        discard,
        calledSuit: null,
        penaltyType,
        pendingPenalty,
        turn: card.value === 1 || card.value === 8 || card.value === 14 ? "player" : "opponent",
        message,
      };
    });
  };

  const chooseSuit = (suit: PlayingSuit) => {
    if (!game.awaitingSuit) return;
    setGame((current) => current ? { ...current, awaitingSuit: false, calledSuit: suit, turn: "opponent", message: `You called ${SUIT_META[suit].short}. Amaka must follow it.` } : current);
  };

  const draw = () => {
    if (game.turn !== "player" || game.awaitingSuit || game.winner) return;
    const count = game.pendingPenalty || 1;
    setGame((current) => {
      if (!current) return current;
      const result = drawCards(current.market, count);
      return { ...current, hand: [...current.hand, ...result.drawn], market: result.market, pendingPenalty: 0, penaltyType: null, calledSuit: null, turn: "opponent", message: `You drew ${result.drawn.length || count}. Amaka's turn.` };
    });
  };

  const reset = () => {
    setSelected(null);
    setGame(freshGame());
  };

  return (
    <main className="game-page">
      <header className="game-topbar">
        <div className="game-brand"><span className="brand-mark"><span>W!</span></span><span>WHOT ARENA</span><small>LOCAL TABLE · DEMO</small></div>
        <div className="game-statuses"><span className="tag tag-lime">{game.winner ? `${game.winner} won` : game.turn === "player" ? "Your turn" : "Amaka's turn"}</span><span className="tag">{game.market.length} in market</span><Link className="button button-quiet" href="/play"><ArrowLeft size={14} /> Leave</Link></div>
      </header>

      <div className="game-main">
        <div className="felt">
          <div className="turn-indicator">{game.winner ? "ROUND COMPLETE" : game.turn === "player" ? "YOUR TURN" : "AMAKA IS THINKING"}</div>
          <div className="player-seat top"><span className="seat-avatar">AM</span><span>AMAKA · {game.opponentHand.length} cards</span></div>
          <div className="player-seat left"><span className="seat-avatar">KE</span><span>KELECHI · OUT</span></div>
          <div className="player-seat right"><span className="seat-avatar">MI</span><span>MIDE · OUT</span></div>
          <div className="table-center">
            <div className="pile"><CardFace card={game.market[game.market.length - 1] ?? createCard("whot", 20)} hidden /><span className="pile-label">Market · {game.market.length}</span></div>
            <div className="pile"><CardFace card={topCard(game)} size="lg" /><span className="pile-label">Discard pile</span></div>
          </div>
        </div>

        <section className="hand-bar">
          <div className="hand-head"><h2>Your hand <span className="tag tag-coral" style={{ marginLeft: 7 }}>{game.hand.length} cards</span></h2><span>{game.pendingPenalty ? `Penalty active · ${game.pendingPenalty} cards` : game.calledSuit ? `Called symbol · ${SUIT_META[game.calledSuit].short}` : "Click a legal card to play"}</span></div>
          <div className="hand-cards">
            {game.hand.map((card, index) => <CardFace card={card} key={card.id} onClick={() => playCard(index)} selected={selected === index} />)}
          </div>
          <div className="button-row" style={{ justifyContent: "center", marginTop: 5 }}>
            <button className="button button-primary" disabled={game.turn !== "player" || game.awaitingSuit || Boolean(game.winner)} onClick={draw} type="button">Draw {game.pendingPenalty ? game.pendingPenalty : 1}</button>
            <button className="button button-secondary" onClick={reset} type="button"><RotateCcw size={15} /> New round</button>
          </div>
          {game.awaitingSuit && <div className="choice-row" style={{ justifyContent: "center" }}>{SUITS.map((suit) => <button className="choice-button" key={suit} onClick={() => chooseSuit(suit)} type="button">Call {SUIT_META[suit].short}</button>)}</div>}
        </section>

        <div className="game-bottom-grid">
          <div className="game-message"><strong>Table call</strong>{game.message}</div>
          <aside className="game-message"><strong>Quick help</strong><span><BookOpen size={13} style={{ verticalAlign: "-2px" }} /> Match number or symbol. Whot is wild.</span><br /><span><CircleHelp size={13} style={{ verticalAlign: "-2px" }} /> Need the full reference? <Link href="/rules" style={{ textDecoration: "underline" }}>Open rules</Link></span></aside>
        </div>
      </div>
    </main>
  );
}
