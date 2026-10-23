import type { ClientMessage, ServerMessage, User } from "../shared/protocol";
import type { Session } from "./session";

type StateMessage = Extract<ServerMessage, { type: "state" }>;

const PING_MS = 25_000;
const FATAL_CODES = new Set([4001, 4003]);

/** WebSocket to the game room that reconnects with backoff and exposes the latest state reactively. */
export class Connection {
  you = $state<User | null>(null);
  latest = $state<StateMessage | null>(null);
  connected = $state(false);
  error = $state<string | null>(null);
  fatal = $state<string | null>(null);

  private session: Session;
  private ws: WebSocket | null = null;
  private attempts = 0;
  private ping: ReturnType<typeof setInterval> | undefined;

  constructor(session: Session) {
    this.session = session;
    this.open();
  }

  send(message: ClientMessage) {
    this.error = null;
    this.ws?.send(JSON.stringify(message));
  }

  private open() {
    const { apiBase, instanceId, accessToken } = this.session;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}${apiBase}/api/ws?instance=${encodeURIComponent(instanceId)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.connected = true;
      ws.send(JSON.stringify({ type: "hello", accessToken } satisfies ClientMessage));
      // Keeps the Discord proxy from dropping idle sockets; the room answers without waking up.
      this.ping = setInterval(() => ws.send("ping"), PING_MS);
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "welcome") this.you = message.you;
      else if (message.type === "state") this.latest = message;
      else this.error = message.message;
    };

    ws.onclose = (event) => {
      clearInterval(this.ping);
      this.connected = false;
      if (FATAL_CODES.has(event.code)) {
        this.fatal = event.reason || "Disconnected";
        return;
      }
      setTimeout(() => this.open(), Math.min(500 * 2 ** this.attempts++, 10_000));
    };
  }
}
