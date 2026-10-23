import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol";
import type { GameRoom } from "../src/worker/game-room";

type StateMessage = Extract<ServerMessage, { type: "state" }>;

let instanceCounter = 0;
const newInstance = () => `test-${++instanceCounter}`;

async function connect(instance: string) {
  const response = await exports.default.fetch(`https://example.com/api/ws?instance=${instance}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = response.webSocket;
  if (!ws) throw new Error(`No WebSocket (status ${response.status})`);
  const inbox: ServerMessage[] = [];
  let closeCode: number | null = null;
  ws.addEventListener("message", (e) => inbox.push(JSON.parse(e.data as string)));
  ws.addEventListener("close", (e) => {
    closeCode = e.code;
  });
  ws.accept();

  return {
    ws,
    send: (message: ClientMessage | string) => ws.send(typeof message === "string" ? message : JSON.stringify(message)),
    /** Waits for and consumes the next message of `type` matching `where`. */
    async next<T extends ServerMessage["type"]>(
      type: T,
      where: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    ): Promise<Extract<ServerMessage, { type: T }>> {
      for (let i = 0; i < 200; i++) {
        const index = inbox.findIndex((m) => m.type === type && where(m as Extract<ServerMessage, { type: T }>));
        if (index >= 0) return inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error(`Timed out waiting for ${type}; inbox: ${JSON.stringify(inbox)}`);
    },
    closeCode: () => closeCode,
  };
}

async function player(instance: string, id: number) {
  const client = await connect(instance);
  client.send({ type: "hello", accessToken: `mock:${id}:Player ${id}` });
  await client.next("welcome");
  return client;
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    const instance = url.match(/activity-instances\/(.+)$/)?.[1];
    if (instance) {
      const guild = instance.startsWith("blocked") ? "other-guild" : "allowed-guild";
      return Response.json({ instance_id: instance, location: { guild_id: guild } });
    }
    if (url.endsWith("/users/@me")) return new Response("Unauthorized", { status: 401 });
    throw new Error(`Unexpected fetch ${url}`);
  });
});

afterEach(() => vi.restoreAllMocks());

describe("GameRoom", () => {
  it("authenticates, seats players and broadcasts the game to everyone", async () => {
    const instance = newInstance();
    const a = await player(instance, 1);
    const b = await player(instance, 2);

    a.send({ type: "join" });
    b.send({ type: "join" });
    await a.next("state", (m) => m.game.players.length === 2);
    a.send({ type: "start" });

    const state = await b.next("state", (m) => m.game.phase === "playing");
    expect(state.game.players.map((p) => p.id)).toEqual(["mock-1", "mock-2"]);
    expect(state.game).not.toHaveProperty("deck");
    expect(state.connected.sort()).toEqual(["mock-1", "mock-2"]);
  });

  it("rejects bad messages, unauthenticated actions and out-of-turn moves", async () => {
    const instance = newInstance();
    const anon = await connect(instance);
    anon.send("not json");
    expect((await anon.next("error")).message).toBe("Invalid message");
    anon.send({ type: "join" });
    expect((await anon.next("error")).message).toBe("Not authenticated");

    const a = await player(instance, 1);
    a.send({ type: "hit" });
    expect((await a.next("error")).message).toBe("You are not seated");
  });

  it("closes the socket when Discord rejects the access token", async () => {
    const client = await connect(newInstance());
    client.send({ type: "hello", accessToken: "real-but-invalid" });
    expect((await client.next("error")).message).toBe("Authentication failed");
    await vi.waitFor(() => expect(client.closeCode()).toBe(4001));
  });

  it("rejects instances running outside the allowed servers", async () => {
    const client = await connect(`blocked-${newInstance()}`);
    client.send({ type: "hello", accessToken: "mock:1:Player 1" });
    expect((await client.next("error")).message).toMatch(/isn't available/);
    await vi.waitFor(() => expect(client.closeCode()).toBe(4003));
  });

  it("lists connected users who are not seated as spectators", async () => {
    const instance = newInstance();
    const a = await player(instance, 1);
    await player(instance, 2);
    a.send({ type: "join" });
    const state = await a.next("state", (m) => m.game.players.length === 1);
    expect(state.spectators).toEqual([{ id: "mock-2", name: "Player 2" }]);
  });

  it("keeps a player's seat across reconnects and evictions", async () => {
    const instance = newInstance();
    const a = await player(instance, 1);
    a.send({ type: "join" });
    await a.next("state", (m) => m.game.players.length === 1);
    a.ws.close();

    await evictDurableObject(env.GAME_ROOM.getByName(instance));

    const again = await player(instance, 1);
    const state = await again.next("state");
    expect(state.game.players.map((p) => p.id)).toEqual(["mock-1"]);
    expect(state.connected).toEqual(["mock-1"]);
  });

  it("acts for a disconnected player when their turn times out", async () => {
    const instance = newInstance();
    const a = await player(instance, 1);
    const b = await player(instance, 2);
    a.send({ type: "join" });
    b.send({ type: "join" });
    await a.next("state", (m) => m.game.players.length === 2);
    a.send({ type: "start" });
    const started = await b.next("state", (m) => m.game.phase === "playing");
    const waitingOn = started.game.pending?.chooser ?? started.game.current!;
    const [absent, present] = waitingOn === "mock-1" ? [a, b] : [b, a];
    absent.ws.close();
    await present.next("state", (m) => !m.connected.includes(waitingOn));

    const stub = env.GAME_ROOM.getByName(instance);
    await runInDurableObject(stub, (room: GameRoom) => {
      const internals = room as unknown as { room: { turnDeadline: { player: string; at: number } | null } };
      expect(internals.room.turnDeadline?.player).toBe(waitingOn);
      internals.room.turnDeadline!.at = 0;
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await present.next("state", (m) => m.game.log.length > started.game.log.length);
  });
});

describe("HTTP routes", () => {
  it("validates WebSocket upgrades and token requests", async () => {
    expect((await exports.default.fetch("https://example.com/api/ws?instance=x")).status).toBe(426);
    const bad = await exports.default.fetch("https://example.com/api/ws?instance=a%20b", { headers: { Upgrade: "websocket" } });
    expect(bad.status).toBe(400);
    const token = await exports.default.fetch("https://example.com/api/token", { method: "POST", body: "{}" });
    expect(token.status).toBe(400);
  });
});
