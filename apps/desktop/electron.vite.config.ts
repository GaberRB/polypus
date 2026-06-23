import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

// electron-vite builds three targets: main (Node), preload (Node), renderer (web).
// Defaults point at src/main/index.ts, src/preload/index.ts, src/renderer/index.html.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: { "@": resolve("src/renderer/src") },
    },
    plugins: [react()],
  },
});
