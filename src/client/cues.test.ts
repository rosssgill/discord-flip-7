import { describe, expect, it } from "vitest";
import type { ActionKind, Card } from "../game/cards";
import { type Action, applyAction, createGame, type GameState } from "../game/engine";
import { seededRng } from "../game/rng";
import { toView } from "../game/view";
import { soundCues } from "./cues";
import { DRAW_DURATION_MS, drawDelay } from "./timing";

const rng = seededRng(1);
let nextId = 1000;
const num = (value: number): Card => ({ id: nextId++, kind: "number", value });
const act = (action: ActionKind): Card => ({ id: nextId++, kind: "action", action });

function play(s: GameState, playerId: string, action: Action): GameState {
  const result = applyAction(s, playerId, action, rng);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

/** A lobby with players A and B, ready to deal `deck` (top first) with B dealing. */
function lobby(deck: Card[]): GameState {
  let s = play(play(createGame(), "A", { type: "join", name: "A" }), "B", { type: "join", name: "B" });
  s = { ...s, phase: "roundOver", deck, round: 0, dealer: 1 };
  return s;
}

const cues = (prev: GameState, next: GameState, you = "A") => soundCues(toView(prev), toView(next), you);

describe("drawDelay", () => {
  it("staggers small draws evenly and squeezes big deals into a few seconds", () => {
    expect(drawDelay(1, 3)).toBe(350);
    expect(drawDelay(17, 18)).toBeLessThan(2400);
  });
});

describe("soundCues", () => {
  it("stays quiet for the first state after connecting", () => {
    expect(soundCues(null, toView(lobby([])), "A")).toEqual([]);
  });

  it("plays a flip per drawn card in draw order, then your-turn after the last lands", () => {
    const before = lobby([num(1), num(2)]);
    const after = play(before, "A", { type: "nextRound" });
    expect(cues(before, after)).toEqual([
      { sound: "flip", delayMs: DRAW_DURATION_MS / 2 },
      { sound: "flip", delayMs: drawDelay(1, 2) + DRAW_DURATION_MS / 2 },
      { sound: "yourTurn", delayMs: drawDelay(1, 2) + DRAW_DURATION_MS },
    ]);
  });

  it("plays stay immediately", () => {
    const dealt = play(lobby([num(1), num(2)]), "A", { type: "nextRound" });
    const after = play(dealt, "A", { type: "stay" });
    expect(cues(dealt, after, "A")).toContainEqual({ sound: "stay", delayMs: 0 });
  });

  it("plays bust when the duplicate lands", () => {
    const dealt = play(lobby([num(5), num(6), num(5)]), "A", { type: "nextRound" });
    const after = play(dealt, "A", { type: "hit" });
    expect(cues(dealt, after, "B")).toContainEqual({ sound: "bust", delayMs: DRAW_DURATION_MS });
  });

  it("plays freeze as soon as the target is chosen", () => {
    const dealt = play(lobby([act("freeze"), num(2)]), "A", { type: "nextRound" });
    const after = play(dealt, "A", { type: "choose", target: "B" });
    expect(cues(dealt, after)).toContainEqual({ sound: "freeze", delayMs: 0 });
  });

  it("plays the victory tune when the game is won", () => {
    let s = lobby([num(10), num(1)]);
    s.players[0].total = 195;
    s = play(s, "A", { type: "nextRound" });
    s = play(s, "A", { type: "stay" });
    const after = play(s, "B", { type: "stay" });
    expect(cues(s, after)).toContainEqual({ sound: "victory", delayMs: 0 });
  });

  it("plays the Draw 7 fanfare", () => {
    let s = play(lobby([1, 9, 2, 3, 4, 5, 6, 7].map(num)), "A", { type: "nextRound" });
    s = play(play(s, "A", { type: "hit" }), "B", { type: "stay" });
    for (let i = 0; i < 4; i++) s = play(s, "A", { type: "hit" });
    const after = play(s, "A", { type: "hit" });
    expect(cues(s, after).map((c) => c.sound)).toContain("draw7");
  });
});
