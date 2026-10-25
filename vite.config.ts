import { cloudflare } from "@cloudflare/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";

// `pnpm dev:discord` serves through a cloudflared tunnel, where HMR must connect on 443.
const tunnel = process.env.DISCORD_TUNNEL === "1";

export default defineConfig({
  plugins: [tailwindcss(), svelte(), cloudflare()],
  resolve: {
    alias: { $lib: path.resolve("./src/lib") },
  },
  server: {
    allowedHosts: [".trycloudflare.com"],
    hmr: tunnel ? { clientPort: 443 } : undefined,
  },
});
