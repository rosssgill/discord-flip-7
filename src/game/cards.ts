export type Modifier = "+2" | "+4" | "+6" | "+8" | "+10" | "x2";
export type ActionKind = "freeze" | "flipThree" | "secondChance";

export type Card = { id: number } & (
  | { kind: "number"; value: number }
  | { kind: "modifier"; modifier: Modifier }
  | { kind: "action"; action: ActionKind }
);

export const MODIFIERS: Modifier[] = ["+2", "+4", "+6", "+8", "+10", "x2"];
export const ACTIONS: ActionKind[] = ["freeze", "flipThree", "secondChance"];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  // One 0, then n copies of each n from 1 to 12.
  cards.push({ id: id++, kind: "number", value: 0 });
  for (let value = 1; value <= 12; value++) {
    for (let i = 0; i < value; i++) cards.push({ id: id++, kind: "number", value });
  }
  for (const modifier of MODIFIERS) cards.push({ id: id++, kind: "modifier", modifier });
  for (const action of ACTIONS) {
    for (let i = 0; i < 3; i++) cards.push({ id: id++, kind: "action", action });
  }
  return cards;
}
