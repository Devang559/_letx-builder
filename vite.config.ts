import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { fileURLToPath, URL } from "node:url";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react(), wasm()],
  build: {
    target: "esnext",
  },
  resolve: {
    alias: [
      {
        // The published BLAKE3 package omits generated WASM glue; Siglum already falls back to a JS hash.
        find: "blake3-wasm/browser.js",
        replacement: fileURLToPath(new URL("./src/blake3-fallback.ts", import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    exclude: ["@siglum/engine"],
  },
  server: {
    headers: isolationHeaders,
  },
  preview: {
    headers: isolationHeaders,
  },
});
