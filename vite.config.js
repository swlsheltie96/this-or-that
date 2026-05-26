import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [svelte(), basicSsl()],
  build: {
    outDir: "dist",
  },
  server: {
    port: 3001, // Frontend dev server
    host: true, // bind to 0.0.0.0 so other devices on the network can connect
    proxy: {
      // Proxy API calls to your backend server
      "/get-lists": "http://localhost:3000",
      "/get-sorted-list": "http://localhost:3000",
      "/get-list-info": "http://localhost:3000",
      "/create-list": "http://localhost:3000",
      "/check-password": "http://localhost:3000",
      "/add-item": "http://localhost:3000",
      "/update-item": "http://localhost:3000",
      "/delete-item": "http://localhost:3000",
      "/delete-list": "http://localhost:3000",
      "^/vote$": "http://localhost:3000",
      "/get-pair": "http://localhost:3000",
      "/update-list-metadata": "http://localhost:3000",
      "/change-password": "http://localhost:3000",
      "/get-elo-history": "http://localhost:3000",
      "/recent-changes": "http://localhost:3000",
      "/og-image": "http://localhost:3000",
      "/upload-image": "http://localhost:3000",
      "/generate": "http://localhost:3000",
      "/admin": "http://localhost:3000",
      "/stats": "http://localhost:3000",
      "/heartbeat": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  // Enable SPA routing - serve index.html for all routes
  appType: "spa",
});
