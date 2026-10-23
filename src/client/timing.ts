const DRAW_STAGGER_MS = 350;
// Big deals speed up so that dealing to 18 players still takes a couple of seconds.
const MAX_STAGGER_TOTAL_MS = 2400;
export const DRAW_DURATION_MS = 500;

/** When the `order`th of `count` cards drawn by one action (e.g. the deal or Flip Three) starts flying. */
export function drawDelay(order: number, count: number): number {
  return order * Math.min(DRAW_STAGGER_MS, MAX_STAGGER_TOTAL_MS / count);
}
