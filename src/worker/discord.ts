import type { User } from "../shared/protocol";

const API = "https://discord.com/api/v10";

export async function exchangeCode(env: Env, code: string): Promise<string> {
  const response = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!response.ok) throw new Error(`Token exchange failed: ${response.status}`);
  const { access_token } = await response.json<{ access_token: string }>();
  return access_token;
}

/** Resolves an access token to its Discord user, or null if Discord rejects it. */
export async function getUser(env: Env, accessToken: string): Promise<User | null> {
  if (env.DEV_AUTH_BYPASS === "true" && accessToken.startsWith("mock:")) {
    const [, id, name] = accessToken.split(":");
    return id && name ? { id: `mock-${id}`, name, avatar: null } : null;
  }
  const response = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const user = await response.json<{
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  }>();
  return {
    id: user.id,
    name: user.global_name ?? user.username,
    // Activities may load cdn.discordapp.com/avatars directly, but not the default avatars under /embed.
    avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null,
  };
}

/** The server an Activity instance is running in, or null for DMs and unknown instances. */
export async function getInstanceGuild(env: Env, instanceId: string): Promise<string | null> {
  const response = await fetch(`${API}/applications/${env.DISCORD_CLIENT_ID}/activity-instances/${instanceId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (!response.ok) return null;
  const instance = await response.json<{ location?: { guild_id?: string | null } }>();
  return instance.location?.guild_id ?? null;
}

export function allowedGuilds(env: Env): string[] {
  return env.ALLOWED_GUILD_IDS.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
