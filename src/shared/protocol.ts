import { z } from "zod";
import type { GameView } from "../game/view";

export const clientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), accessToken: z.string().min(1).max(500) }),
  z.object({ type: z.literal("join") }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("start") }),
  z.object({ type: z.literal("hit") }),
  z.object({ type: z.literal("stay") }),
  z.object({ type: z.literal("choose"), target: z.string().max(64) }),
  z.object({ type: z.literal("nextRound") }),
  z.object({ type: z.literal("newGame") }),
]);

export type ClientMessage = z.infer<typeof clientMessage>;

/** How long a player has for each decision before the server acts for them. */
export const TURN_TIMEOUT_MS = 15_000;
/** Pause between rounds before the next one starts on its own. */
export const NEXT_ROUND_DELAY_MS = 8_000;

export interface User {
  id: string;
  name: string;
  avatar: string | null;
}

export type ServerMessage =
  | { type: "welcome"; you: User }
  | {
      type: "state";
      game: GameView;
      spectators: User[];
      connected: string[];
      /** Time left on the turn or next-round timer when sent; relative, so clients needn't share the server's clock. */
      timerMsLeft: number | null;
    }
  | { type: "error"; message: string };
