import { exchangeCode } from "./discord";

export { GameRoom } from "./game-room";

const INSTANCE_ID = /^[\w.:-]{1,128}$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/token" && request.method === "POST") {
      const body = await request.json<{ code?: unknown }>().catch(() => null);
      if (typeof body?.code !== "string") return Response.json({ error: "Missing code" }, { status: 400 });
      try {
        return Response.json({ access_token: await exchangeCode(env, body.code) });
      } catch {
        return Response.json({ error: "Token exchange failed" }, { status: 502 });
      }
    }

    if (url.pathname === "/api/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426 });
      const instance = url.searchParams.get("instance") ?? "";
      if (!INSTANCE_ID.test(instance)) return new Response("Invalid instance", { status: 400 });
      return env.GAME_ROOM.getByName(instance).fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
