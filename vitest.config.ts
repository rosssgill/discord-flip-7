import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "game", include: ["src/game/**/*.test.ts"] } },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                DISCORD_CLIENT_ID: "test-client",
                DISCORD_CLIENT_SECRET: "test-secret",
                DISCORD_BOT_TOKEN: "test-bot",
                ALLOWED_GUILD_IDS: "allowed-guild",
                DEV_AUTH_BYPASS: "true",
              },
            },
          }),
        ],
        test: { name: "worker", include: ["test/**/*.test.ts"] },
      },
    ],
  },
});
