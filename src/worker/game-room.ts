import { DurableObject } from "cloudflare:workers";
import { type Action, applyAction, autoAction, awaiting, createGame, type GameState } from "../game/engine";
import { cryptoRng } from "../game/rng";
import { toView } from "../game/view";
import { clientMessage, type ServerMessage, type User } from "../shared/protocol";
import { allowedGuilds, getInstanceGuild, getUser } from "./discord";

export const AUTH_TIMEOUT_MS = 10_000;
export const TURN_TIMEOUT_MS = 30_000;

interface Attachment {
  user: User | null;
  connectedAt: number;
}

interface Room {
  game: GameState;
  instanceId: string;
  guildChecked: boolean;
  turnDeadline: { player: string; at: number } | null;
}

/** One game per Discord Activity instance. State lives in storage so the object can hibernate between moves. */
export class GameRoom extends DurableObject<Env> {
  private room: Room = { game: createGame(), instanceId: "", guildChecked: false, turnDeadline: null };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<Room>("room")) ?? this.room;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const instanceId = new URL(request.url).searchParams.get("instance") ?? "";
    if (!this.room.instanceId) this.room.instanceId = instanceId;

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ user: null, connectedAt: Date.now() } satisfies Attachment);
    await this.scheduleAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let parsed;
    try {
      parsed = clientMessage.safeParse(JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)));
    } catch {
      parsed = null;
    }
    if (!parsed?.success) return send(ws, { type: "error", message: "Invalid message" });
    const message = parsed.data;
    const attachment = ws.deserializeAttachment() as Attachment;

    if (message.type === "hello") {
      if (attachment.user) return;
      const user = await getUser(this.env, message.accessToken);
      if (!user) return reject(ws, 4001, "Authentication failed");
      if (!(await this.guildAllowed())) return reject(ws, 4003, "This Activity isn't available in this server");
      ws.serializeAttachment({ ...attachment, user } satisfies Attachment);
      send(ws, { type: "welcome", you: user });
      return this.changed();
    }

    const user = attachment.user;
    if (!user) return send(ws, { type: "error", message: "Not authenticated" });
    const action: Action = message.type === "join" ? { type: "join", name: user.name } : message;
    const result = applyAction(this.room.game, user.id, action, cryptoRng);
    if (!result.ok) return send(ws, { type: "error", message: result.error });
    this.room.game = result.state;
    await this.changed();
  }

  async webSocketClose(ws: WebSocket) {
    await this.changed(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.changed(ws);
  }

  async alarm() {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const { user, connectedAt } = ws.deserializeAttachment() as Attachment;
      if (!user && ws.readyState === WebSocket.OPEN && now - connectedAt >= AUTH_TIMEOUT_MS) {
        reject(ws, 4001, "Authentication timed out");
      }
    }

    const deadline = this.room.turnDeadline;
    if (deadline && deadline.at <= now) {
      this.room.turnDeadline = null;
      const result = autoAction(this.room.game, deadline.player, cryptoRng);
      if (result.ok) this.room.game = result.state;
    }
    await this.changed();
  }

  /** Persists, broadcasts and re-arms timers after any change. `closing` is a socket that is going away. */
  private async changed(closing?: WebSocket) {
    const sessions = this.sessions(closing);
    const connected = new Set(sessions.map(([, user]) => user.id));

    const waitingOn = awaiting(this.room.game);
    if (waitingOn && !connected.has(waitingOn)) {
      if (this.room.turnDeadline?.player !== waitingOn) {
        this.room.turnDeadline = { player: waitingOn, at: Date.now() + TURN_TIMEOUT_MS };
      }
    } else {
      this.room.turnDeadline = null;
    }
    await this.ctx.storage.put("room", this.room);
    await this.scheduleAlarm();

    const seated = new Set(this.room.game.players.map((p) => p.id));
    const spectators = [...new Map(sessions.map(([, u]) => [u.id, u])).values()].filter((u) => !seated.has(u.id));
    const message: ServerMessage = {
      type: "state",
      game: toView(this.room.game),
      spectators,
      connected: [...connected],
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
    if (this.room.turnDeadline) times.push(this.room.turnDeadline.at);
    for (const ws of this.ctx.getWebSockets()) {
      const { user, connectedAt } = ws.deserializeAttachment() as Attachment;
      if (!user && ws.readyState === WebSocket.OPEN) times.push(connectedAt + AUTH_TIMEOUT_MS);
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
