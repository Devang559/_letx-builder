import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { fileURLToPath, URL } from "node:url";
import type { Plugin, ViteDevServer } from "vite";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const previewHeaders = {
  ...isolationHeaders,
  // Required for the Siglum WASM engine to compile in the browser
  "Content-Security-Policy":
    "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob:; " +
    "worker-src 'self' blob:; " +
  "connect-src 'self' http://localhost:8787 http://localhost:8081 https: data:; " +
    "img-src 'self' data: blob:; " +
    "style-src 'self' 'unsafe-inline';",
};

const texliveArchiveBase =
  "https://ftp.tu-chemnitz.de/pub/tug/historic/systems/texlive/2025/tlnet-final/archive";

function texliveArchiveApi(): Plugin {
  const installMiddleware = (server: Pick<ViteDevServer, "middlewares">) => {
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      const routePrefix = "/api/texlive/";
      if (!pathname.startsWith(routePrefix)) {
        next();
        return;
      }

      const packageName = pathname.slice(routePrefix.length);
      if (!/^[a-z0-9][a-z0-9.+_-]*$/i.test(packageName)) {
        res.statusCode = 400;
        res.end("Invalid TeX Live package name");
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.end("Method not allowed");
        return;
      }

      void (async () => {
        try {
          const response = await fetch(
            `${texliveArchiveBase}/${encodeURIComponent(packageName)}.tar.xz`,
            { method: req.method, signal: AbortSignal.timeout(120_000) },
          );
          if (!response.ok) {
            res.statusCode = response.status;
            res.end(`TeX Live package ${packageName} was not found`);
            return;
          }

          res.statusCode = response.status;
          res.setHeader("Content-Type", "application/x-xz");
          res.setHeader("Cache-Control", "public, max-age=86400");
          if (req.method === "HEAD") {
            res.end();
            return;
          }

          const archive = new Uint8Array(await response.arrayBuffer());
          res.setHeader("Content-Length", archive.byteLength);
          res.end(archive);
        } catch (error) {
          console.error(`Failed to fetch TeX Live package ${packageName}:`, error);
          res.statusCode = 502;
          res.end(`Failed to fetch TeX Live package ${packageName}`);
        }
      })();
    });
  };

  return {
    name: "texlive-archive-api",
    configureServer: installMiddleware,
  };
}

export default defineConfig({
  plugins: [react(), wasm(), texliveArchiveApi()],
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
    headers: previewHeaders,
  },
});