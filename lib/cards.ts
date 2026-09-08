export type Suit = "circle" | "triangle" | "cross" | "square" | "star" | "whot";
export type PlayingSuit = Exclude<Suit, "whot">;

export type Card = {
  id: string;
  suit: Suit;
  value: number;
  score: number;
};

export const SUIT_META: Record<Suit, { label: string; short: string; color: string }> = {
  circle: { label: "Ball / circle", short: "Ball", color: "#ff8d86" },
  triangle: { label: "Angle / triangle", short: "Angle", color: "#9ad1ff" },
  cross: { label: "Cross / plus", short: "Cross", color: "#ffb457" },
  square: { label: "Carpet / square", short: "Carpet", color: "#b8ed78" },
  star: { label: "Star", short: "Star", color: "#cba9ff" },
  whot: { label: "Whot / Crown", short: "Whot", color: "#f8e75e" },
};

export const SUITS: PlayingSuit[] = ["circle", "triangle", "cross", "square", "star"];

export const NUMBERS: Record<PlayingSuit, number[]> = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
};

export const ACTIONS = {
  1: { name: "Hold On", description: "The same player goes again." },
  2: { name: "Pick Two", description: "Next player draws two, unless they defend with a 2." },
  5: { name: "Pick Three", description: "Next player draws three, unless they defend with a 5." },
  8: { name: "Suspension", description: "The next player misses their turn." },
  14: { name: "General Market", description: "Every other player draws one card." },
  20: { name: "Whot / Crown", description: "Wild card; call the next symbol." },
} as const;

export function cardScore(suit: Suit, value: number) {
  if (suit === "star") return value * 2;
  if (suit === "whot") return 20;
  return value;
}

export function createCard(suit: Suit, value: number, copy = 0): Card {
  return { id: `${suit}-${value}-${copy}`, suit, value, score: cardScore(suit, value) };
}

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const value of NUMBERS[suit]) cards.push(createCard(suit, value));
  }
  for (let copy = 0; copy < 5; copy += 1) cards.push(createCard("whot", 20, copy));
  return cards;
}

export function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function isPlayable(card: Card, topCard: Card, calledSuit?: PlayingSuit | null) {
  if (card.suit === "whot") return true;
  if (topCard.suit === "whot") return calledSuit === card.suit;
  return card.suit === topCard.suit || card.value === topCard.value;
}

export function actionLabel(card: Card) {
  if (card.value === 20) return ACTIONS[20].name;
  if (card.value in ACTIONS) return ACTIONS[card.value as keyof typeof ACTIONS].name;
  return "";
}

export function displayNumber(card: Card) {
  return String(card.value);
}

export const CARD_MANIFEST = {
  circle: NUMBERS.circle,
  triangle: NUMBERS.triangle,
  cross: NUMBERS.cross,
  square: NUMBERS.square,
  star: NUMBERS.star,
  whot: [20, 20, 20, 20, 20],
};
