import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: "dist",
  },
  server: {
    port: 3001, // Frontend dev server
    proxy: {
      // Proxy API calls to your backend server
      "/get-lists": "http://localhost:3000",
      "/get-sorted-list": "http://localhost:3000",
      "/get-list-info": "http://localhost:3000",
      "/create-list": "http://localhost:3000",
      "/check-password": "http://localhost:3000",
      "/add-item": "http://localhost:3000",
      "/delete-item": "http://localhost:3000",
      "/delete-list": "http://localhost:3000",
      "^/vote$": "http://localhost:3000",
      "/get-pair": "http://localhost:3000",
      "/update-list-metadata": "http://localhost:3000",
      "/change-password": "http://localhost:3000",
    },
  },
  // Enable SPA routing - serve index.html for all routes
  appType: "spa",
});
