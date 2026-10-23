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

export interface User {
  id: string;
  name: string;
}

export type ServerMessage =
  | { type: "welcome"; you: User }
  | { type: "state"; game: GameView; spectators: User[]; connected: string[] }
  | { type: "error"; message: string };
