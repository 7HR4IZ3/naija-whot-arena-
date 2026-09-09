export type GameType = "classic" | "knockout";
export type DrawMode = "one" | "until-playable";
export type TurnTimer = "off" | "10" | "15" | "30";
export type PenaltyMode = "stack" | "block" | "none";

export type RoomSettings = {
  gameType: GameType;
  initialHand: 3 | 4 | 5 | 6;
  drawMode: DrawMode;
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

const gameTypes: GameType[] = ["classic", "knockout"];
const drawModes: DrawMode[] = ["one", "until-playable"];
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

export function normalizeRoomSettings(value: unknown): RoomSettings {
  if (!isRecord(value)) return { ...DEFAULT_ROOM_SETTINGS };
  const legacyStacking = typeof value.stackActions === "boolean" ? value.stackActions : null;
  const legacyTimer = typeof value.timer === "boolean" ? value.timer : null;
  const legacyKnockout = typeof value.knockout === "boolean" ? value.knockout : null;
  return {
    gameType: pick(value.gameType, gameTypes, legacyKnockout === true ? "knockout" : DEFAULT_ROOM_SETTINGS.gameType),
    initialHand: numberValue(value.initialHand, [3, 4, 5, 6], DEFAULT_ROOM_SETTINGS.initialHand),
    drawMode: pick(value.drawMode, drawModes, DEFAULT_ROOM_SETTINGS.drawMode),
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

export function gameTypeLabel(gameType: GameType, targetScore = 100) {
  return gameType === "knockout" ? `${targetScore}-point knockout` : "Classic round";
}

export function penaltyModeLabel(mode: PenaltyMode) {
  if (mode === "stack") return "Stack penalty";
  if (mode === "block") return "Block + clear";
  return "No defence";
}
