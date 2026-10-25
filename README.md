# Draw 7 for Discord

A multiplayer push-your-luck card game that runs inside Discord as an [Activity](https://discord.com/developers/docs/activities/overview). Flip cards to reach 200 points, but a duplicate number busts your round.

Inspired by _Flip 7_ by The Op Games. This is an unofficial fan project and is not affiliated with or endorsed by The Op Games.

## Stack

- **Rules engine** (`src/game`): pure TypeScript with no I/O, shared by server and client.
- **Server** (`src/worker`): Cloudflare Worker plus one Durable Object per Discord Activity instance, over hibernatable WebSockets.
- **Client** (`src/client`): Svelte 5, built with Vite, using Discord's Embedded App SDK.

## Development

Requires [mise](https://mise.jdx.dev), which installs the pinned Node and Bun versions.

```sh
mise install
bun install
cp .dev.vars.example .dev.vars   # worker secrets
cp .env.example .env             # client config
bun dev
```

Outside Discord the app signs you in as a mock player, so you can play in several tabs:
`http://localhost:5173/?user=1&room=test`, `?user=2&room=test`, …

| Command         | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `bun run test`  | Rules unit tests, plus Worker/Durable Object tests in the Workers runtime |
| `bun run check` | Type-check client, worker and tests                                       |
| `bun run types` | Regenerate Worker types after changing `wrangler.jsonc` or `.dev.vars`    |

### Running inside Discord

1. Create an application in the [Developer Portal](https://discord.com/developers/applications), enable **Activities**, and add `http://localhost` as an OAuth2 redirect.
2. Put the client ID in `.env` (`VITE_DISCORD_CLIENT_ID`), and the client ID and secret in `.dev.vars`.
3. Run `bun run dev:discord` and `cloudflared tunnel --url http://localhost:5173`.
4. Under **Activities → URL Mappings**, map `/` to the tunnel host.
5. Launch the Activity from a voice channel's App Launcher.

Unverified Activities only work for the app's developer team and app testers, in servers with fewer than 25 members.

## Deploying

```sh
bunx wrangler login
bunx wrangler secret put DISCORD_CLIENT_ID
bunx wrangler secret put DISCORD_CLIENT_SECRET
bunx wrangler secret put DISCORD_BOT_TOKEN   # only needed with ALLOWED_GUILD_IDS
bun run deploy
```

Then map `/` to the deployed `*.workers.dev` host in the URL Mappings.

To run it on a larger server, verify the app (Developer Portal → App Verification). To keep it on that server only:

- leave Discovery off
- turn Public Bot off
- allow Guild Install only
- set `ALLOWED_GUILD_IDS` in `wrangler.jsonc` to your server's ID
