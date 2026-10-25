import type { Card } from "./cards";

export const DRAW_7_BONUS = 15;
export const WINNING_SCORE = 200;

export function roundScore(
  numbers: Card[],
  modifiers: Card[],
  draw7: boolean,
): number {
  let sum = 0;
  for (const card of numbers) if (card.kind === "number") sum += card.value;
  let bonus = 0;
  for (const card of modifiers) {
    if (card.kind !== "modifier") continue;
    // x2 doubles only the number cards, not other modifiers or the Draw 7 bonus.
    if (card.modifier === "x2") sum *= 2;
    else bonus += Number(card.modifier.slice(1));
  }
  return sum + bonus + (draw7 ? DRAW_7_BONUS : 0);
}
