import { cloudflare } from "@cloudflare/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// `pnpm dev:discord` serves through a cloudflared tunnel, where HMR must connect on 443.
const tunnel = process.env.DISCORD_TUNNEL === "1";

export default defineConfig({
  plugins: [svelte(), cloudflare()],
  server: {
    allowedHosts: [".trycloudflare.com"],
    hmr: tunnel ? { clientPort: 443 } : undefined,
  },
});
