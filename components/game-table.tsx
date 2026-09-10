"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, CircleHelp, RotateCcw } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { ACTIONS, buildDeck, createCard, isPlayable, shuffle, SUIT_META, SUITS, type Card, type PlayingSuit } from "@/lib/cards";
import { actionEnabled, DEFAULT_ROOM_SETTINGS, normalizeRoomSettings, penaltyMode, type RoomSettings } from "@/lib/rules";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

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

function freshGame(settings: RoomSettings): GameState {
  const opening = createCard("circle", 4);
  const remaining = shuffle(buildDeck().filter((card) => card.id !== opening.id));
  return {
    hand: remaining.slice(0, settings.initialHand),
    opponentHand: remaining.slice(settings.initialHand, settings.initialHand * 2),
    market: remaining.slice(settings.initialHand * 2),
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

function canPlay(game: GameState, card: Card, settings: RoomSettings) {
  if (card.value === 20 && !settings.whotEnabled) return false;
  if (game.pendingPenalty > 0) {
    if (card.value !== game.penaltyType || !game.penaltyType) return false;
    return penaltyMode(game.penaltyType, settings) !== "none";
  }

  const top = topCard(game);
  if (top.suit === "whot" && !game.calledSuit) return card.suit === "whot" || settings.whotEnabled;
  return isPlayable(card, top, game.calledSuit);
}

function drawForTurn(game: GameState, hand: Card[], count: number, settings: RoomSettings) {
  if (count > 1 || game.pendingPenalty > 0 || settings.drawMode === "one") return drawCards(game.market, count);

  let market = [...game.market];
  const drawn: Card[] = [];
  while (market.length > 0) {
    const result = drawCards(market, 1);
    if (!result.drawn.length) break;
    drawn.push(result.drawn[0]);
    market = result.market;
    const candidate = { ...game, hand: [...hand, ...drawn], market };
    if (drawn.some((card) => canPlay(candidate, card, settings))) break;
  }
  return { drawn, market };
}

function pickCalledSuit(hand: Card[]): PlayingSuit {
  const counts = SUITS.map((suit) => ({ suit, count: hand.filter((card) => card.suit === suit).length }));
  return counts.sort((a, b) => b.count - a.count)[0]?.suit ?? "circle";
}

function penaltyValue(card: Card, settings: RoomSettings): 2 | 5 | null {
  if (card.value === 2 && settings.pickTwoEnabled) return 2;
  if (card.value === 5 && settings.pickThreeEnabled) return 5;
  return null;
}

function finishCall(handLength: number, actor: string, settings: RoomSettings) {
  if (!settings.endCalls) return "";
  if (handLength === 2) return `${actor} called semi-last.`;
  if (handLength === 1) return `${actor} called last card.`;
  return "";
}

export function GameTable({ roomCode = null }: { roomCode?: string | null }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const initialise = async () => {
        let nextSettings = DEFAULT_ROOM_SETTINGS;

        if (roomCode) {
          try {
            const stored = window.sessionStorage.getItem(`whot:room:${roomCode.toUpperCase()}:settings`);
            if (stored) nextSettings = normalizeRoomSettings(JSON.parse(stored));
          } catch {
            nextSettings = DEFAULT_ROOM_SETTINGS;
          }

          if (isSupabaseConfigured()) {
            const { data } = await createClient().from("rooms").select("rule_config").eq("code", roomCode.toUpperCase()).maybeSingle();
            if (data?.rule_config) nextSettings = normalizeRoomSettings(data.rule_config);
          }
        }

        if (!active) return;
        setSettings(nextSettings);
        setGame(freshGame(nextSettings));
      };

      void initialise();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [roomCode]);

  useEffect(() => {
    if (!game || game.turn !== "opponent" || game.awaitingSuit || game.winner) return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (!current || current.turn !== "opponent" || current.winner) return current;
        const cardIndex = current.opponentHand.findIndex((card) => canPlay(current, card, settings));
        if (cardIndex === -1) {
          const count = current.pendingPenalty || 1;
          const result = drawForTurn(current, current.opponentHand, count, settings);
          const amount = result.drawn.length;
          return {
            ...current,
            opponentHand: [...current.opponentHand, ...result.drawn],
            market: result.market,
            pendingPenalty: 0,
            penaltyType: null,
            calledSuit: null,
            turn: "player",
            message: amount ? `Amaka picked up ${amount}. Your turn.` : "The market is empty. Your turn.",
          };
        }

        const card = current.opponentHand[cardIndex];
        const opponentHand = current.opponentHand.filter((_, index) => index !== cardIndex);
        const discard = [...current.discard, card];
        if (opponentHand.length === 0) {
          return { ...current, opponentHand, discard, winner: "Amaka", message: "Amaka emptied their hand first." };
        }

        const defending = current.pendingPenalty > 0 && card.value === current.penaltyType && current.penaltyType !== null;
        if (defending) {
          const mode = penaltyMode(card.value as 2 | 5, settings);
          if (mode === "block") {
            return { ...current, opponentHand, discard, calledSuit: null, penaltyType: null, pendingPenalty: 0, turn: "player", message: `Amaka blocked the ${card.value}-card penalty. Your turn.` };
          }
          const pendingPenalty = current.pendingPenalty + card.value;
          return { ...current, opponentHand, discard, calledSuit: null, penaltyType: card.value as 2 | 5, pendingPenalty, turn: "player", message: `Amaka stacked ${card.value}. You now face ${pendingPenalty} cards.` };
        }

        if (card.suit === "whot" && settings.whotEnabled) {
          const calledSuit = settings.whotCallsSuit ? pickCalledSuit(opponentHand) : null;
          return {
            ...current,
            opponentHand,
            discard,
            calledSuit,
            penaltyType: null,
            pendingPenalty: 0,
            turn: "player",
            message: calledSuit ? `Amaka played Whot and called ${SUIT_META[calledSuit].short}.` : "Amaka played Whot. Your turn.",
          };
        }

        const activeAction = actionEnabled(card.value, settings);
        const penalty = penaltyValue(card, settings);
        if (penalty) {
          const pendingPenalty = card.value;
          return {
            ...current,
            opponentHand,
            discard,
            calledSuit: null,
            penaltyType: penalty,
            pendingPenalty,
            turn: "player",
            message: `${ACTIONS[penalty].name}! Defend with another ${penalty}, or pick up ${pendingPenalty}.`,
          };
        }

        const marketResult = activeAction && card.value === 14 ? drawCards(current.market, 1) : { drawn: [], market: current.market };
        const call = finishCall(opponentHand.length, "Amaka", settings);
        const actionMessage = activeAction && card.value === 1
          ? "Hold On — Amaka goes again."
          : activeAction && card.value === 8
            ? "Suspension — you lose your turn."
            : activeAction && card.value === 14
              ? "General Market — you pick one."
              : `Amaka played ${card.value} ${SUIT_META[card.suit].short}.`;
        return {
          ...current,
          opponentHand: [...opponentHand, ...marketResult.drawn],
          market: marketResult.market,
          discard,
          calledSuit: null,
          penaltyType: null,
          pendingPenalty: 0,
          turn: activeAction && (card.value === 1 || card.value === 8 || card.value === 14) ? "opponent" : "player",
          message: [call, actionMessage].filter(Boolean).join(" "),
        };
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [game, settings]);

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
    if (!card || !canPlay(game, card, settings)) {
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

      const defending = current.pendingPenalty > 0 && card.value === current.penaltyType && current.penaltyType !== null;
      if (defending) {
        const mode = penaltyMode(card.value as 2 | 5, settings);
        if (mode === "block") {
          return { ...current, hand, discard, calledSuit: null, penaltyType: null, pendingPenalty: 0, turn: "opponent", message: `You blocked the ${card.value}-card penalty. Amaka's turn.` };
        }
        const pendingPenalty = current.pendingPenalty + card.value;
        return { ...current, hand, discard, calledSuit: null, penaltyType: card.value as 2 | 5, pendingPenalty, turn: "opponent", message: `You stacked ${card.value}. Amaka must defend or pick up ${pendingPenalty}.` };
      }

      if (card.suit === "whot" && settings.whotEnabled) {
        if (settings.whotCallsSuit) {
          return { ...current, hand, discard, calledSuit: null, awaitingSuit: true, pendingPenalty: 0, penaltyType: null, message: "Whot! Choose the symbol for the next turn." };
        }
        return { ...current, hand, discard, calledSuit: null, awaitingSuit: false, pendingPenalty: 0, penaltyType: null, turn: "opponent", message: "Whot! No symbol call this round. Amaka's turn." };
      }

      const activeAction = actionEnabled(card.value, settings);
      const penalty = penaltyValue(card, settings);
      if (penalty) {
        return {
          ...current,
          hand,
          discard,
          calledSuit: null,
          penaltyType: penalty,
          pendingPenalty: card.value,
          turn: "opponent",
          message: `${ACTIONS[penalty].name}! Amaka must defend or pick up ${card.value}.`,
        };
      }

      const marketResult = activeAction && card.value === 14 ? drawCards(current.market, 1) : { drawn: [], market: current.market };
      const call = finishCall(hand.length, "You", settings);
      const actionMessage = activeAction && card.value === 1
        ? "Hold On — you go again."
        : activeAction && card.value === 8
          ? "Suspension — Amaka loses their turn."
          : activeAction && card.value === 14
            ? "General Market — Amaka picks one."
            : `You played ${card.value} ${SUIT_META[card.suit].short}.`;
      return {
        ...current,
        hand,
        opponentHand: marketResult.drawn.length ? [...current.opponentHand, ...marketResult.drawn] : current.opponentHand,
        market: marketResult.market,
        discard,
        calledSuit: null,
        penaltyType: null,
        pendingPenalty: 0,
        turn: activeAction && (card.value === 1 || card.value === 8 || card.value === 14) ? "player" : "opponent",
        message: [call, actionMessage].filter(Boolean).join(" "),
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
      const result = drawForTurn(current, current.hand, count, settings);
      const amount = result.drawn.length;
      return {
        ...current,
        hand: [...current.hand, ...result.drawn],
        market: result.market,
        pendingPenalty: 0,
        penaltyType: null,
        calledSuit: null,
        turn: "opponent",
        message: amount ? `You drew ${amount}. Amaka's turn.` : "The market is empty. Amaka's turn.",
      };
    });
  };

  const reset = () => {
    setSelected(null);
    setGame(freshGame(settings));
  };

  const roomLabel = roomCode ? `ROOM ${roomCode.toUpperCase()}` : "LOCAL TABLE · DEMO";
  const formatLabel = settings.gameType === "knockout" ? "Knockout" : "Classic";
  const timerLabel = settings.turnTimer === "off" ? "Untimed" : `${settings.turnTimer}s timer`;

  return (
    <main className="game-page">
      <header className="game-topbar">
        <div className="game-brand"><span className="brand-mark"><span>W!</span></span><span>WHOT ARENA</span><small>{roomLabel}</small></div>
        <div className="game-statuses"><span className="tag tag-lime">{game.winner ? `${game.winner} won` : game.turn === "player" ? "Your turn" : "Amaka's turn"}</span><span className="tag">{formatLabel} · {settings.initialHand} cards</span><span className="tag">{timerLabel}</span><Link className="button button-quiet" href="/play"><ArrowLeft size={14} /> Leave</Link></div>
      </header>

      <div className="game-main game-layout">
        <section aria-label="Live Whot table" className="felt table-field">
          <div className="turn-indicator">{game.winner ? "ROUND COMPLETE" : game.turn === "player" ? "YOUR TURN" : "AMAKA IS THINKING"}</div>
          <div className="player-seat seat seat-top top"><span className="seat-avatar player-avatar">AM</span><span>Amaka · {game.opponentHand.length} cards</span></div>
          <div className="table-center center-piles">
            <div className="pile"><CardFace card={game.market[game.market.length - 1] ?? createCard("whot", 20)} hidden /><span className="pile-label">Market · {game.market.length}</span></div>
            <div className="pile"><CardFace card={topCard(game)} size="lg" /><span className="pile-label">Discard pile</span></div>
          </div>
          <div className="turn-note"><strong>{game.winner ? "Round complete." : game.turn === "player" ? "Your turn." : "Amaka is thinking."}</strong></div>
        </section>

        <section className="hand-bar">
          <div className="hand-head"><span className="hand-label">Your hand<br /><strong>{game.hand.length} cards</strong></span><span>{game.pendingPenalty ? `Penalty active · ${game.pendingPenalty} cards` : game.calledSuit ? `Called symbol · ${SUIT_META[game.calledSuit].short}` : "Click a legal card to play"}</span></div>
          <div className="hand-cards">
            {game.hand.map((card, index) => <CardFace card={card} key={card.id} onClick={() => playCard(index)} selected={selected === index} />)}
          </div>
        </section>

        <div className="game-actions">
          <p>{game.awaitingSuit ? "Choose the symbol Whot should call." : "Play a matching shape or draw one card."}</p>
          <div className="action-group">
            {game.awaitingSuit && <div className="choice-row">{SUITS.map((suit) => <button className="choice-button" key={suit} onClick={() => chooseSuit(suit)} type="button">Call {SUIT_META[suit].short}</button>)}</div>}
            <button className="button button-secondary" disabled={game.turn !== "player" || game.awaitingSuit || Boolean(game.winner)} onClick={draw} type="button">Draw {game.pendingPenalty ? game.pendingPenalty : 1}</button>
            <button className="button button-primary" onClick={reset} type="button"><RotateCcw size={15} /> New round</button>
          </div>
        </div>

        <div className="game-bottom-grid">
          <div className="game-message" role="status" aria-live="polite"><strong>Table call</strong>{game.message}</div>
          <aside className="game-message"><strong>Quick help</strong><span><BookOpen size={13} style={{ verticalAlign: "-2px" }} /> Match number or symbol. {settings.whotEnabled ? "Whot is wild." : "Whot is disabled."}</span><br /><span><CircleHelp size={13} style={{ verticalAlign: "-2px" }} /> Need the full reference? <Link href="/rules" style={{ textDecoration: "underline" }}>Open rules</Link></span></aside>
        </div>
      </div>
    </main>
  );
}
