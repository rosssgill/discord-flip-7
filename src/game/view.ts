import { awaiting, type GameState } from "./engine";

export type GameView = Omit<GameState, "deck" | "discard" | "tasks"> & {
  deckCount: number;
  discardCount: number;
  waitingOn: string | null;
};

/** What clients may see: everything is face up except the deck order. */
export function toView(state: GameState): GameView {
  const { deck, discard, tasks: _tasks, ...rest } = state;
  return { ...rest, deckCount: deck.length, discardCount: discard.length, waitingOn: awaiting(state) };
}
