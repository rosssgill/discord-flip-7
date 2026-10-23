import { cubicInOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";
import { DRAW_DURATION_MS, drawDelay } from "./timing";

export type Pile = "deck" | "discard";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function offsetFrom(node: Element, pile: Pile): { dx: number; dy: number } | null {
  const target = document.querySelector(`[data-pile="${pile}"]`);
  if (!target) return null;
  const from = target.getBoundingClientRect();
  const to = node.getBoundingClientRect();
  return { dx: from.left - to.left, dy: from.top - to.top };
}

/**
 * Flies a card in from the deck face down, flipping it face up for the last half of the flight.
 * `order` is the card's position among the latest action's draws; other cards (-1) appear without animating,
 * so remounting the table doesn't replay old draws.
 */
export function drawFromDeck(
  node: Element,
  { order, count }: { order: number; count: number },
): TransitionConfig {
  const offset = offsetFrom(node, "deck");
  if (order < 0 || !offset || reducedMotion.matches) return { duration: 0 };
  return {
    delay: drawDelay(order, count),
    duration: DRAW_DURATION_MS,
    easing: cubicInOut,
    css: (_t, u) =>
      `transform: translate(${offset.dx * u}px, ${offset.dy * u}px) rotateY(${Math.min(1, u * 2) * 180}deg)`,
  };
}

/** Flies a card off to the discard pile, fading as it lands. */
export function toDiscard(node: Element, { duration = 400 } = {}): TransitionConfig {
  const offset = offsetFrom(node, "discard");
  if (!offset || reducedMotion.matches) return { duration: 0 };
  return {
    duration,
    easing: cubicInOut,
    css: (t, u) => `transform: translate(${offset.dx * u}px, ${offset.dy * u}px); opacity: ${Math.min(1, t * 3)}`,
  };
}
