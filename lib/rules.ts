export type GameType = "classic" | "knockout" | "tender";
export type DrawMode = "one" | "until-playable";
export type EmptyMarketMode = "score" | "recycle";
export type TurnTimer = "off" | "10" | "15" | "30";
export type PenaltyMode = "stack" | "block" | "none";

export const MIN_ROOM_PLAYERS = 2;
export const MAX_ROOM_PLAYERS = 8;
export const MIN_INITIAL_HAND = 3;
export const MAX_INITIAL_HAND = 12;
export const MARKET_RESERVE_CARDS = 1;

export type RoomSettings = {
  gameType: GameType;
  initialHand: number;
  drawMode: DrawMode;
  emptyMarketMode: EmptyMarketMode;
  turnTimer: TurnTimer;
  targetScore: 50 | 100 | 200;
  clockwise: boolean;
  endCalls: boolean;
  starDouble: boolean;
  whotEnabled: boolean;
  whotCallsSuit: boolean;
  holdOnEnabled: boolean;
  pickTwoEnabled: boolean;
  pickTwoMode: PenaltyMode;
  pickThreeEnabled: boolean;
  pickThreeMode: PenaltyMode;
  suspensionEnabled: boolean;
  generalMarketEnabled: boolean;
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  gameType: "classic",
  initialHand: 6,
  drawMode: "one",
  emptyMarketMode: "score",
  turnTimer: "10",
  targetScore: 100,
  clockwise: true,
  endCalls: true,
  starDouble: true,
  whotEnabled: true,
  whotCallsSuit: true,
  holdOnEnabled: true,
  pickTwoEnabled: true,
  pickTwoMode: "stack",
  pickThreeEnabled: true,
  pickThreeMode: "stack",
  suspensionEnabled: true,
  generalMarketEnabled: true,
};

export type RoomPreset = "classic" | "knockout" | "tender";

export const ROOM_PRESETS: Array<{ id: RoomPreset; label: string; description: string; settings: Partial<RoomSettings> }> = [
  {
    id: "classic",
    label: "Classic",
    description: "First player out wins.",
    settings: { ...DEFAULT_ROOM_SETTINGS, gameType: "classic" },
  },
  {
    id: "tender",
    label: "Tender",
    description: "Lowest hand leaves each deal.",
    settings: { ...DEFAULT_ROOM_SETTINGS, gameType: "tender", turnTimer: "off" },
  },
  {
    id: "knockout",
    label: "Knockout",
    description: "Scores build to a target.",
    settings: { ...DEFAULT_ROOM_SETTINGS, gameType: "knockout" },
  },
];

const gameTypes: GameType[] = ["classic", "knockout", "tender"];
const drawModes: DrawMode[] = ["one", "until-playable"];
const emptyMarketModes: EmptyMarketMode[] = ["score", "recycle"];
const timers: TurnTimer[] = ["off", "10", "15", "30"];
const targets = [50, 100, 200] as const;
const penaltyModes: PenaltyMode[] = ["stack", "block", "none"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? value as T : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue<T extends number>(value: unknown, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? value as T : fallback;
}

function integerRangeValue(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function normalizeRoomSettings(value: unknown): RoomSettings {
  if (!isRecord(value)) return { ...DEFAULT_ROOM_SETTINGS };
  const legacyStacking = typeof value.stackActions === "boolean" ? value.stackActions : null;
  const legacyTimer = typeof value.timer === "boolean" ? value.timer : null;
  const legacyKnockout = typeof value.knockout === "boolean" ? value.knockout : null;
  return {
    gameType: pick(value.gameType, gameTypes, legacyKnockout === true ? "knockout" : DEFAULT_ROOM_SETTINGS.gameType),
    initialHand: integerRangeValue(value.initialHand, MIN_INITIAL_HAND, MAX_INITIAL_HAND, DEFAULT_ROOM_SETTINGS.initialHand),
    drawMode: pick(value.drawMode, drawModes, DEFAULT_ROOM_SETTINGS.drawMode),
    emptyMarketMode: pick(value.emptyMarketMode, emptyMarketModes, DEFAULT_ROOM_SETTINGS.emptyMarketMode),
    turnTimer: pick(value.turnTimer, timers, legacyTimer === null ? DEFAULT_ROOM_SETTINGS.turnTimer : legacyTimer ? "10" : "off"),
    targetScore: numberValue(value.targetScore, targets, DEFAULT_ROOM_SETTINGS.targetScore),
    clockwise: booleanValue(value.clockwise, DEFAULT_ROOM_SETTINGS.clockwise),
    endCalls: booleanValue(value.endCalls, DEFAULT_ROOM_SETTINGS.endCalls),
    starDouble: booleanValue(value.starDouble, DEFAULT_ROOM_SETTINGS.starDouble),
    whotEnabled: booleanValue(value.whotEnabled, DEFAULT_ROOM_SETTINGS.whotEnabled),
    whotCallsSuit: booleanValue(value.whotCallsSuit, DEFAULT_ROOM_SETTINGS.whotCallsSuit),
    holdOnEnabled: booleanValue(value.holdOnEnabled, DEFAULT_ROOM_SETTINGS.holdOnEnabled),
    pickTwoEnabled: booleanValue(value.pickTwoEnabled, legacyStacking ?? DEFAULT_ROOM_SETTINGS.pickTwoEnabled),
    pickTwoMode: pick(value.pickTwoMode, penaltyModes, legacyStacking === false ? "none" : DEFAULT_ROOM_SETTINGS.pickTwoMode),
    pickThreeEnabled: booleanValue(value.pickThreeEnabled, legacyStacking ?? DEFAULT_ROOM_SETTINGS.pickThreeEnabled),
    pickThreeMode: pick(value.pickThreeMode, penaltyModes, legacyStacking === false ? "none" : DEFAULT_ROOM_SETTINGS.pickThreeMode),
    suspensionEnabled: booleanValue(value.suspensionEnabled, DEFAULT_ROOM_SETTINGS.suspensionEnabled),
    generalMarketEnabled: booleanValue(value.generalMarketEnabled, DEFAULT_ROOM_SETTINGS.generalMarketEnabled),
  };
}

export function actionEnabled(value: number, settings: RoomSettings) {
  if (value === 1) return settings.holdOnEnabled;
  if (value === 2) return settings.pickTwoEnabled;
  if (value === 5) return settings.pickThreeEnabled;
  if (value === 8) return settings.suspensionEnabled;
  if (value === 14) return settings.generalMarketEnabled;
  if (value === 20) return settings.whotEnabled;
  return false;
}

export function penaltyMode(value: 2 | 5, settings: RoomSettings): PenaltyMode {
  return value === 2 ? settings.pickTwoMode : settings.pickThreeMode;
}

export function gameTypeLabel(gameType: GameType) {
  if (gameType === "tender") return "Tender elimination";
  return gameType === "knockout" ? "Knockout elimination" : "Classic round";
}

export function gameTypeDescription(gameType: GameType) {
  if (gameType === "tender") return "When the market is exhausted, the lowest hand total is eliminated and the next deal begins.";
  if (gameType === "knockout") return "Play a normal round, then eliminate the player with the highest hand total before the next deal.";
  return "The first player to clear their hand wins the round.";
}

export function emptyMarketDescription(mode: EmptyMarketMode) {
  return mode === "recycle"
    ? "Keep the top card face up and shuffle the rest of the pot into a new market."
    : "Count hand points when everyone is blocked; the highest total loses."
}

export function deckSize(settings: Pick<RoomSettings, "whotEnabled">) {
  return settings.whotEnabled ? 54 : 49;
}

export function maxInitialHandForPlayers(players: number, whotEnabled: boolean) {
  if (!Number.isInteger(players) || players < MIN_ROOM_PLAYERS) return MAX_INITIAL_HAND;
  return Math.min(MAX_INITIAL_HAND, Math.floor((deckSize({ whotEnabled }) - MARKET_RESERVE_CARDS) / players));
}

export function maxPlayersForInitialHand(initialHand: number, whotEnabled: boolean) {
  if (!Number.isInteger(initialHand) || initialHand < MIN_INITIAL_HAND) return MAX_ROOM_PLAYERS;
  return Math.min(MAX_ROOM_PLAYERS, Math.floor((deckSize({ whotEnabled }) - MARKET_RESERVE_CARDS) / initialHand));
}

export function validateRoomConfiguration(maxPlayers: number, settings: RoomSettings) {
  if (!Number.isInteger(maxPlayers) || maxPlayers < MIN_ROOM_PLAYERS || maxPlayers > MAX_ROOM_PLAYERS) {
    return `Choose between ${MIN_ROOM_PLAYERS} and ${MAX_ROOM_PLAYERS} players.`;
  }
  if (!Number.isInteger(settings.initialHand) || settings.initialHand < MIN_INITIAL_HAND || settings.initialHand > MAX_INITIAL_HAND) {
    return `Opening hand must be between ${MIN_INITIAL_HAND} and ${MAX_INITIAL_HAND} cards.`;
  }
  const maximum = maxInitialHandForPlayers(maxPlayers, settings.whotEnabled);
  if (settings.initialHand > maximum) {
    return `${maxPlayers} players can start with at most ${maximum} cards; one card must remain for the opening market.`;
  }
  return null;
}

export function penaltyModeLabel(mode: PenaltyMode) {
  if (mode === "stack") return "Stack penalty";
  if (mode === "block") return "Block + clear";
  return "No defence";
}
