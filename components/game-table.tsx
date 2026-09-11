"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCardMotion } from "@/lib/use-card-motion";
import "./online-game.css";
import { GameModal } from "@/components/game-modal";
import { CardFace } from "@/components/card-face";
import { ACTIONS, buildDeck, createCard, isPlayable, shuffle, SUIT_META, SUITS, type Card, type PlayingSuit } from "@/lib/cards";
import { actionEnabled, DEFAULT_ROOM_SETTINGS, gameTypeLabel, normalizeRoomSettings, penaltyMode, type RoomSettings } from "@/lib/rules";
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
  passes: number;
  tenderTally?: Array<{ name: string; score: number; eliminated: boolean }>;
  marketTally?: Array<{ name: string; score: number; eliminated: boolean }>;
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
    passes: 0,
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

function refillMarket(game: GameState, settings: RoomSettings) {
  if (game.market.length > 0 || settings.emptyMarketMode !== "recycle" || game.discard.length <= 1) {
    return { game, recycled: false };
  }
  const top = topCard(game);
  return {
    game: { ...game, market: shuffle(game.discard.slice(0, -1)), discard: top ? [top] : game.discard },
    recycled: true,
  };
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

function drawForTurn(game: GameState, hand: Card[], count: number, settings: RoomSettings, forceOne = false) {
  let working = game;
  const drawn: Card[] = [];
  let recycled = false;
  const takeOne = () => {
    const refill = refillMarket(working, settings);
    working = refill.game;
    recycled ||= refill.recycled;
    const result = drawCards(working.market, 1);
    if (!result.drawn.length) return false;
    drawn.push(result.drawn[0]);
    working = { ...working, market: result.market };
    return true;
  };

  if (forceOne || count > 1 || game.pendingPenalty > 0 || settings.drawMode === "one") {
    for (let index = 0; index < count; index += 1) {
      if (!takeOne()) break;
    }
    return { drawn, market: working.market, discard: working.discard, recycled };
  }

  while (true) {
    if (working.market.length === 0 && (settings.emptyMarketMode !== "recycle" || working.discard.length <= 1)) break;
    if (!takeOne()) break;
    const candidate = { ...working, hand: [...hand, ...drawn] };
    if (drawn.some((card) => canPlay(candidate, card, settings))) break;
  }
  return { drawn, market: working.market, discard: working.discard, recycled };
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

function handScore(hand: Card[]) {
  return hand.reduce((total, card) => total + card.score, 0);
}

const SUIT_SYMBOLS: Record<PlayingSuit, string> = { circle: "●", triangle: "▲", cross: "✚", square: "■", star: "★" };

function resolveTender(game: GameState): GameState {
  const you = handScore(game.hand);
  const amaka = handScore(game.opponentHand);
  const eliminated = you <= amaka ? "You" : "Amaka";
  const winner = eliminated === "You" ? "Amaka" : "You";
  return {
    ...game,
    passes: 0,
    winner,
    tenderTally: [
      { name: "You", score: you, eliminated: eliminated === "You" },
      { name: "Amaka", score: amaka, eliminated: eliminated === "Amaka" },
    ].sort((a, b) => a.score - b.score),
    message: `Tender round complete. ${eliminated} had the lowest hand total (${Math.min(you, amaka)}) and was eliminated.`,
  };
}

function resolveBlockedRound(game: GameState): GameState {
  const you = handScore(game.hand);
  const amaka = handScore(game.opponentHand);
  const winner = you <= amaka ? "You" : "Amaka";
  const loser = winner === "You" ? "Amaka" : "You";
  return {
    ...game,
    passes: 0,
    winner,
    marketTally: [
      { name: "You", score: you, eliminated: loser === "You" },
      { name: "Amaka", score: amaka, eliminated: loser === "Amaka" },
    ].sort((a, b) => b.score - a.score),
    message: `Market blocked. ${loser} loses with ${loser === "You" ? you : amaka} points; ${winner} wins the round.`,
  };
}

export function GameTable({ roomCode = null }: { roomCode?: string | null }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [selected, setSelected] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const root = useRef<HTMLElement>(null);
  const moving = useCardMotion(game ? { key: `practice-${round}`, top: topCard(game), players: [{ id: 'player', count: game.hand.length, cards: game.hand }, { id: 'opponent', count: game.opponentHand.length, cards: game.opponentHand }] } : null, root);

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
    if (!game || moving || game.turn !== "opponent" || game.awaitingSuit || game.winner) return;
    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (!current || current.turn !== "opponent" || current.winner) return current;
        const cardIndex = current.opponentHand.findIndex((card) => canPlay(current, card, settings));
        if (cardIndex === -1) {
          const count = current.pendingPenalty || 1;
          const result = drawForTurn(current, current.opponentHand, count, settings);
          const amount = result.drawn.length;
          const next: GameState = {
            ...current,
            opponentHand: [...current.opponentHand, ...result.drawn],
            market: result.market,
            discard: result.discard,
            pendingPenalty: 0,
            penaltyType: null,
            calledSuit: current.calledSuit,
            turn: "player",
            passes: amount ? 0 : current.passes + 1,
            message: amount
              ? `${result.recycled ? "The pot was shuffled into the market. " : ""}Amaka picked up ${amount}. Your turn.`
              : "The market is empty. Your turn.",
          };
          if (next.passes < 2) return next;
          return settings.gameType === "tender" ? resolveTender(next) : resolveBlockedRound(next);
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
          return { ...current, opponentHand, discard, calledSuit: null, penaltyType: null, pendingPenalty: 0, turn: "player", passes: 0, message: `Amaka blocked the ${card.value}-card penalty. Your turn.` };
          }
          const pendingPenalty = current.pendingPenalty + (card.value === 5 ? 3 : 2);
          return { ...current, opponentHand, discard, calledSuit: null, penaltyType: card.value as 2 | 5, pendingPenalty, turn: "player", passes: 0, message: `Amaka stacked ${card.value}. You now face ${pendingPenalty} cards.` };
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
            passes: 0,
            message: calledSuit ? `Amaka played Whot and called ${SUIT_META[calledSuit].short}.` : "Amaka played Whot. Your turn.",
          };
        }

        const activeAction = actionEnabled(card.value, settings);
        const penalty = penaltyValue(card, settings);
        if (penalty) {
          const pendingPenalty = card.value === 5 ? 3 : 2;
          return {
            ...current,
            opponentHand,
            discard,
            calledSuit: null,
            penaltyType: penalty,
            pendingPenalty,
            turn: "player",
            passes: 0,
            message: `${ACTIONS[penalty].name}! Defend with another ${penalty}, or pick up ${pendingPenalty}.`,
          };
        }

        const marketResult = activeAction && card.value === 14
          ? drawForTurn(current, current.hand, 1, settings, true)
          : { drawn: [], market: current.market, discard: current.discard, recycled: false };
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
          opponentHand,
          hand: [...current.hand, ...marketResult.drawn],
          market: marketResult.market,
          discard: [...marketResult.discard, card],
          calledSuit: null,
          penaltyType: null,
          pendingPenalty: 0,
          turn: activeAction && (card.value === 1 || card.value === 8 || card.value === 14) ? "opponent" : "player",
          passes: 0,
          message: [marketResult.recycled ? "The pot was shuffled into the market." : "", call, actionMessage].filter(Boolean).join(" "),
        };
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [game, settings, moving]);

  if (!game) {
    return <main className="game-page"><div className="auth-wrap"><div className="auth-card"><h1>Dealing…</h1><p>Shuffling the 54-card deck.</p></div></div></main>;
  }

  const playCard = (index: number) => {
    if (game.winner || moving) return;
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
      if (hand.length === 0) return { ...current, hand, discard, winner: "You", passes: 0, message: "You emptied your hand. Round won!" };

      const defending = current.pendingPenalty > 0 && card.value === current.penaltyType && current.penaltyType !== null;
      if (defending) {
        const mode = penaltyMode(card.value as 2 | 5, settings);
        if (mode === "block") {
          return { ...current, hand, discard, calledSuit: null, penaltyType: null, pendingPenalty: 0, turn: "opponent", passes: 0, message: `You blocked the ${card.value}-card penalty. Amaka's turn.` };
        }
        const pendingPenalty = current.pendingPenalty + (card.value === 5 ? 3 : 2);
        return { ...current, hand, discard, calledSuit: null, penaltyType: card.value as 2 | 5, pendingPenalty, turn: "opponent", passes: 0, message: `You stacked ${card.value}. Amaka must defend or pick up ${pendingPenalty}.` };
      }

      if (card.suit === "whot" && settings.whotEnabled) {
        if (settings.whotCallsSuit) {
          return { ...current, hand, discard, calledSuit: null, awaitingSuit: true, pendingPenalty: 0, penaltyType: null, passes: 0, message: "Whot! Choose the symbol for the next turn." };
        }
        return { ...current, hand, discard, calledSuit: null, awaitingSuit: false, pendingPenalty: 0, penaltyType: null, turn: "opponent", passes: 0, message: "Whot! No symbol call this round. Amaka's turn." };
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
          pendingPenalty: card.value === 5 ? 3 : 2,
          turn: "opponent",
          passes: 0,
          message: `${ACTIONS[penalty].name}! Amaka must defend or pick up ${card.value === 5 ? 3 : 2}.`,
        };
      }

      const marketResult = activeAction && card.value === 14
        ? drawForTurn(current, current.opponentHand, 1, settings, true)
        : { drawn: [], market: current.market, discard: current.discard, recycled: false };
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
        discard: [...marketResult.discard, card],
        calledSuit: null,
        penaltyType: null,
        pendingPenalty: 0,
        turn: activeAction && (card.value === 1 || card.value === 8 || card.value === 14) ? "player" : "opponent",
        passes: 0,
        message: [marketResult.recycled ? "The pot was shuffled into the market." : "", call, actionMessage].filter(Boolean).join(" "),
      };
    });
  };

  const chooseSuit = (suit: PlayingSuit) => {
    if (!game.awaitingSuit) return;
    setGame((current) => current ? { ...current, awaitingSuit: false, calledSuit: suit, turn: "opponent", message: `You called ${SUIT_META[suit].short}. Amaka must follow it.` } : current);
  };

  const draw = () => {
    if (moving || game.turn !== "player" || game.awaitingSuit || game.winner) return;
    const count = game.pendingPenalty || 1;
    setGame((current) => {
      if (!current) return current;
      const result = drawForTurn(current, current.hand, count, settings);
      const amount = result.drawn.length;
      const next: GameState = {
        ...current,
        hand: [...current.hand, ...result.drawn],
        market: result.market,
        discard: result.discard,
        pendingPenalty: 0,
        penaltyType: null,
        calledSuit: current.calledSuit,
        turn: "opponent",
        passes: amount ? 0 : current.passes + 1,
        message: amount
          ? `${result.recycled ? "The pot was shuffled into the market. " : ""}You drew ${amount}. Amaka's turn.`
          : "The market is empty. Amaka's turn.",
      };
      if (next.passes < 2) return next;
      return settings.gameType === "tender" ? resolveTender(next) : resolveBlockedRound(next);
    });
  };

  const reset = () => {
    setRound(value => value + 1);
    setSelected(null);
    setGame(freshGame(settings));
  };

  const myTurn = game.turn === "player" && !game.winner && !moving;
  const locked = !myTurn || game.awaitingSuit;
  const wantedSuit = game.calledSuit;
  const resultTally = game.tenderTally ?? game.marketTally;
  return <main className="online-game" ref={root} aria-busy={moving}>
    <header className="arena-game-header"><Link className="button button-secondary" href="/play">Leave</Link><span>whot arena<small>Practice · Untimed</small></span><button className="button button-secondary" disabled={moving} onClick={reset}>New round</button></header>
    <section className="arena-opponents" aria-label="Opponent hand"><div className={`arena-opponent ${game.turn === "opponent" ? "has-turn" : ""}`} data-player="opponent"><p><strong>Amaka</strong><small>{game.opponentHand.length} cards</small></p><div className="arena-backs">{Array.from({length:Math.min(game.opponentHand.length,9)},(_,i)=><Image src="/cards/classic/back.svg" alt="Face down card" width={40} height={60} key={i} unoptimized style={{transform:`rotate(${(i-Math.min(game.opponentHand.length-1,8)/2)*5}deg)`}} />)}</div>{game.opponentHand.length>9 && <small>+{game.opponentHand.length-9}</small>}</div></section>
    <section className="arena-felt" aria-label="Practice Whot table">
      <div className="arena-turn">{game.winner ? "Round complete" : moving ? "Cards moving…" : game.turn === "player" ? "Your turn" : "Amaka’s turn"}</div>
      <div className="arena-piles"><div data-market><CardFace card={topCard(game)} hidden size="lg"/><small>Market · {game.market.length}</small></div><div data-discard><CardFace card={topCard(game)} size="lg"/><small>Playing stack</small></div></div>
      {wantedSuit && <div className="arena-whot-want" role="status" aria-label={`Whot wants ${SUIT_META[wantedSuit].short}. Play that symbol or another Whot.`} style={{ borderColor: SUIT_META[wantedSuit].color }}><span className="arena-whot-want-symbol" style={{ color: SUIT_META[wantedSuit].color }}>{SUIT_SYMBOLS[wantedSuit]}</span><span><small>Whot wants</small><strong>{SUIT_META[wantedSuit].short}</strong><em>Match this symbol or play another Whot</em></span></div>}
      {game.pendingPenalty>0 && <p className="arena-penalty">Pick {game.pendingPenalty} cards</p>}
      <p className="arena-message" aria-live="polite">{game.message}</p>
    </section>
    <section className={`arena-your-hand ${myTurn ? "is-your-turn" : ""}`} data-player="player"><div className="arena-hand-heading"><strong>Your hand <span>{game.hand.length}</span></strong><span className={`arena-turn-badge ${myTurn ? "is-active" : ""}`}>{myTurn ? "Your turn" : "Waiting"}</span><small>Round {round} · {gameTypeLabel(settings.gameType, settings.targetScore)}</small></div>
      <div className="arena-cards">{game.hand.map((card,i)=><CardFace card={card} key={card.id} selected={selected===i} disabled={locked || !canPlay(game,card,settings)} className={canPlay(game,card,settings) ? "can-play" : "cannot-play"} onClick={()=>setSelected(selected===i ? null : i)} />)}</div>
      <div className="arena-controls"><button className="button button-secondary" disabled={locked} onClick={draw}>{game.pendingPenalty ? `Pick ${game.pendingPenalty} cards` : "Go to market"}</button><button className="button button-primary" disabled={locked || selected===null} onClick={()=>{if(selected!==null)playCard(selected);}}>Play selected card</button></div>
      <p className="arena-hint">Tap a highlighted card, then play it. Swipe your hand to see more cards.</p>
    </section>
    {game.awaitingSuit && !moving && <GameModal title="Call a symbol"><div className="arena-shape-picker">{SUITS.map((suit,i)=><button className="button button-secondary" key={suit} onClick={()=>chooseSuit(suit)}><span>{["●","▲","✚","■","★"][i]}</span>{SUIT_META[suit].short}</button>)}</div></GameModal>}
    {game.winner && !moving && <GameModal title={game.winner==="You" ? "You won!" : "Amaka won this round."}><div className={`arena-result ${game.winner==="You" ? "is-winner" : ""}`}>{game.winner==="You" ? "★" : "w."}</div>{resultTally && <><p className="arena-tender-intro">{game.marketTally ? "The market finished. The highest hand total loses." : "The market finished. The lowest hand total is eliminated."}</p><div className="arena-tender-tally">{resultTally.map(player => <div className={`arena-tender-row ${player.eliminated ? "is-eliminated" : ""}`} key={player.name}><span><strong>{player.name}</strong><small>{player.eliminated ? (game.marketTally ? "Highest total · loses" : "Eliminated") : "Still in"}</small></span><b>{player.score}</b></div>)}</div></>}<p>{game.message}</p><p>Ready for another?</p><button className="button button-primary" onClick={reset}>Play again</button><Link className="text-link" href="/play">Back to play</Link></GameModal>}
    <footer className="arena-hint"><Link className="text-link" href="/rules">Table rules</Link> · Local practice against the computer</footer>
  </main>;
}
