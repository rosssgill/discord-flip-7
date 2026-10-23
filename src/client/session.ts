import { DiscordSDK } from "@discord/embedded-app-sdk";

export interface Session {
  accessToken: string;
  instanceId: string;
  /** Discord serves Activities through a proxy that only forwards paths under /.proxy. */
  apiBase: string;
}

const params = new URLSearchParams(location.search);

/** Signs in through Discord, or outside Discord as a mock user (`?user=2&room=test`) for local testing. */
export async function startSession(): Promise<Session> {
  if (!params.has("frame_id")) {
    const user = params.get("user") ?? "1";
    return { accessToken: `mock:${user}:Player ${user}`, instanceId: params.get("room") ?? "local", apiBase: "" };
  }

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });
  const response = await fetch("/.proxy/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error("Could not sign in with Discord");
  const { access_token } = (await response.json()) as { access_token: string };
  await sdk.commands.authenticate({ access_token });
  return { accessToken: access_token, instanceId: sdk.instanceId, apiBase: "/.proxy" };
}
