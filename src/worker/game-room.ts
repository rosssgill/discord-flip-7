import { DurableObject } from "cloudflare:workers";
import {
  type Action,
  applyAction,
  autoAction,
  awaiting,
  createGame,
  type GameState,
} from "../game/engine";
import { cryptoRng } from "../game/rng";
import { toView } from "../game/view";
import {
  clientMessage,
  NEXT_ROUND_DELAY_MS,
  type ServerMessage,
  TURN_TIMEOUT_MS,
  type User,
} from "../shared/protocol";
import { allowedGuilds, getInstanceGuild, getUser } from "./discord";

export const AUTH_TIMEOUT_MS = 10_000;
/** How long a room with nobody connected keeps its state before deleting it. */
export const IDLE_CLEANUP_MS = 24 * 60 * 60 * 1000;

interface Attachment {
  user: User | null;
  connectedAt: number;
}

interface Room {
  game: GameState;
  instanceId: string;
  guildChecked: boolean;
  /** When the server next acts on its own: for a player who ran out of time, or to start the next round. */
  deadline:
    | { kind: "turn"; player: string; at: number }
    | { kind: "nextRound"; at: number }
    | null;
  /** When the last player disconnected, or null while anyone is connected. */
  emptySince: number | null;
}

const newRoom = (): Room => ({
  game: createGame(),
  instanceId: "",
  guildChecked: false,
  deadline: null,
  emptySince: null,
});

/** One game per Discord Activity instance. State lives in storage so the object can hibernate between moves. */
export class GameRoom extends DurableObject<Env> {
  private room: Room = newRoom();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Room>("room");
      // Defaults fill fields added since the room was saved.
      if (stored)
        this.room = {
          ...this.room,
          ...stored,
          game: { ...createGame(), ...stored.game },
        };
    });
  }

  async fetch(request: Request): Promise<Response> {
    const instanceId = new URL(request.url).searchParams.get("instance") ?? "";
    if (!this.room.instanceId) this.room.instanceId = instanceId;

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      user: null,
      connectedAt: Date.now(),
    } satisfies Attachment);
    await this.scheduleAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let parsed;
    try {
      parsed = clientMessage.safeParse(
        JSON.parse(
          typeof raw === "string" ? raw : new TextDecoder().decode(raw),
        ),
      );
    } catch {
      parsed = null;
    }
    if (!parsed?.success)
      return send(ws, { type: "error", message: "Invalid message" });
    const message = parsed.data;
    const attachment = ws.deserializeAttachment() as Attachment;

    if (message.type === "hello") {
      if (attachment.user) return;
      const user = await getUser(this.env, message.accessToken);
      if (!user) return reject(ws, 4001, "Authentication failed");
      if (!(await this.guildAllowed()))
        return reject(ws, 4003, "This Activity isn't available in this server");
      ws.serializeAttachment({ ...attachment, user } satisfies Attachment);
      send(ws, { type: "welcome", you: user });
      return this.changed();
    }

    const user = attachment.user;
    if (!user) return send(ws, { type: "error", message: "Not authenticated" });
    const action: Action =
      message.type === "join"
        ? { type: "join", name: user.name, avatar: user.avatar }
        : message.type === "newGame"
          ? { type: "newGame", keep: this.sessions().map(([, u]) => u.id) }
          : message;
    const result = applyAction(this.room.game, user.id, action, cryptoRng);
    if (!result.ok) return send(ws, { type: "error", message: result.error });
    this.room.game = result.state;
    await this.changed({ moved: true });
  }

  async webSocketClose(ws: WebSocket) {
    await this.changed({ closing: ws });
  }

  async webSocketError(ws: WebSocket) {
    await this.changed({ closing: ws });
  }

  async alarm() {
    const now = Date.now();
    // Discord never reuses an Activity instance ID, so a long-empty room will never be joined again.
    const { emptySince } = this.room;
    if (
      emptySince !== null &&
      now - emptySince >= IDLE_CLEANUP_MS &&
      this.sessions().length === 0
    ) {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.room = newRoom();
      return;
    }

    for (const ws of this.ctx.getWebSockets()) {
      const { user, connectedAt } = ws.deserializeAttachment() as Attachment;
      if (
        !user &&
        ws.readyState === WebSocket.OPEN &&
        now - connectedAt >= AUTH_TIMEOUT_MS
      ) {
        reject(ws, 4001, "Authentication timed out");
      }
    }

    const deadline = this.room.deadline;
    if (deadline && deadline.at <= now) {
      this.room.deadline = null;
      const { game } = this.room;
      const result =
        deadline.kind === "turn"
          ? autoAction(game, deadline.player, cryptoRng)
          : applyAction(
              game,
              game.players[0].id,
              { type: "nextRound" },
              cryptoRng,
            );
      if (result.ok) this.room.game = result.state;
      return this.changed({ moved: result.ok });
    }
    await this.changed();
  }

  /**
   * Persists, broadcasts and re-arms timers after any change.
   * `moved` means the game advanced, which starts a fresh turn timer; `closing` is a socket that is going away.
   */
  private async changed({
    moved = false,
    closing,
  }: { moved?: boolean; closing?: WebSocket } = {}) {
    const sessions = this.sessions(closing);
    const connected = new Set(sessions.map(([, user]) => user.id));

    const waitingOn = awaiting(this.room.game);
    const deadline = this.room.deadline;
    if (connected.size === 0) {
      // Nobody is here to play, so the game pauses rather than timing everyone out.
      this.room.deadline = null;
      this.room.emptySince ??= Date.now();
    } else if (waitingOn) {
      if (moved || deadline?.kind !== "turn" || deadline.player !== waitingOn) {
        this.room.deadline = {
          kind: "turn",
          player: waitingOn,
          at: Date.now() + TURN_TIMEOUT_MS,
        };
      }
    } else if (this.room.game.phase === "roundOver") {
      if (deadline?.kind !== "nextRound")
        this.room.deadline = {
          kind: "nextRound",
          at: Date.now() + NEXT_ROUND_DELAY_MS,
        };
    } else {
      this.room.deadline = null;
    }
    if (connected.size > 0) this.room.emptySince = null;
    await this.ctx.storage.put("room", this.room);
    await this.scheduleAlarm();

    const seated = new Set(this.room.game.players.map((p) => p.id));
    const spectators = [
      ...new Map(sessions.map(([, u]) => [u.id, u])).values(),
    ].filter((u) => !seated.has(u.id));
    const message: ServerMessage = {
      type: "state",
      game: toView(this.room.game),
      spectators,
      connected: [...connected],
      timerMsLeft: this.room.deadline
        ? Math.max(0, this.room.deadline.at - Date.now())
        : null,
    };
    for (const [ws] of sessions) send(ws, message);
  }

  private sessions(closing?: WebSocket): [WebSocket, User][] {
    const out: [WebSocket, User][] = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing || ws.readyState !== WebSocket.OPEN) continue;
      const { user } = ws.deserializeAttachment() as Attachment;
      if (user) out.push([ws, user]);
    }
    return out;
  }

  private async scheduleAlarm() {
    const times: number[] = [];
    if (this.room.deadline) times.push(this.room.deadline.at);
    if (this.room.emptySince !== null)
      times.push(this.room.emptySince + IDLE_CLEANUP_MS);
    for (const ws of this.ctx.getWebSockets()) {
      const { user, connectedAt } = ws.deserializeAttachment() as Attachment;
      if (!user && ws.readyState === WebSocket.OPEN)
        times.push(connectedAt + AUTH_TIMEOUT_MS);
    }
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
  }

  private async guildAllowed(): Promise<boolean> {
    const allowed = allowedGuilds(this.env);
    if (allowed.length === 0 || this.room.guildChecked) return true;
    const guild = await getInstanceGuild(this.env, this.room.instanceId);
    if (!guild || !allowed.includes(guild)) return false;
    this.room.guildChecked = true;
    return true;
  }
}

function send(ws: WebSocket, message: ServerMessage) {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // The socket closed between listing and sending; its close handler rebroadcasts.
  }
}

function reject(ws: WebSocket, code: number, reason: string) {
  send(ws, { type: "error", message: reason });
  ws.close(code, reason);
}
