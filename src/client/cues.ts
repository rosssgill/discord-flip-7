import type { GameView } from "../game/view";
import { DRAW_DURATION_MS, drawDelay } from "./timing";

export type Sound = "flip" | "freeze" | "bust" | "draw7" | "yourTurn" | "victory" | "stay" | "tick" | "hover" | "click";

// Lets the Draw 7 fanfare finish before a game-winning victory tune starts.
const DRAW_7_FANFARE_MS = 900;

export interface Cue {
  sound: Sound;
  delayMs: number;
}

/** Sounds for the change from `prev` to `next`, timed to the draw animations. */
export function soundCues(prev: GameView | null, next: GameView, youId: string): Cue[] {
  // The first state after connecting describes the past, so there is nothing to announce.
  if (!prev) return [];

  const count = next.drawn.length;
  const landsAt = (order: number) => drawDelay(order, count) + DRAW_DURATION_MS;
  const afterDraws = count ? landsAt(count - 1) : 0;
  const cues: Cue[] = next.drawn.map((_, i) => ({ sound: "flip", delayMs: drawDelay(i, count) + DRAW_DURATION_MS / 2 }));

  for (const player of next.players) {
    const before = prev.players.find((p) => p.id === player.id);
    if (!before) continue;
    if (player.status === "frozen" && before.status !== "frozen") cues.push({ sound: "freeze", delayMs: afterDraws });
    if (player.status === "busted" && before.status !== "busted") {
      const duplicate = player.numbers.at(-1);
      const order = duplicate ? next.drawn.indexOf(duplicate.id) : -1;
      cues.push({ sound: "bust", delayMs: order >= 0 ? landsAt(order) : 0 });
    }
    if (player.status === "stayed" && before.status !== "stayed") cues.push({ sound: "stay", delayMs: 0 });
    if (player.draw7 && !before.draw7) cues.push({ sound: "draw7", delayMs: afterDraws });
  }

  if (next.phase === "gameOver" && prev.phase !== "gameOver") {
    const afterFanfare = cues.some((c) => c.sound === "draw7") ? DRAW_7_FANFARE_MS : 0;
    cues.push({ sound: "victory", delayMs: afterDraws + afterFanfare });
  }

  if (next.waitingOn === youId && prev.waitingOn !== youId) cues.push({ sound: "yourTurn", delayMs: afterDraws });
  return cues;
}
