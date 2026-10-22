import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// In production the backend (FastAPI) serves the API, the stimulus images and the built
// frontend. In development Vite serves the frontend with hot reload, forwards /api to the
// backend, and serves the images itself (so ?offline=1 works without any backend).
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";
const STIMULI_DIR = resolve(import.meta.dirname, "../stimuli");
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};

/** Serve repo-root `stimuli/` at /stimuli/ in the dev server. */
function serveStimuli(): Plugin {
  return {
    name: "serve-stimuli",
    configureServer(server) {
      server.middlewares.use("/stimuli", (req, res, next) => {
        const path = resolve(STIMULI_DIR, "." + decodeURIComponent(req.url?.split("?")[0] ?? ""));
        const type = MIME[extname(path).toLowerCase()];
        if (!path.startsWith(STIMULI_DIR + sep) || !type) return next();
        try {
          if (!statSync(path).isFile()) return next();
        } catch {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader("Content-Type", type);
        createReadStream(path).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: "/exp/",
  plugins: [serveStimuli()],
  server: {
    port: 5173,
    proxy: { "/api": BACKEND },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true, // readable stack traces in the browser console, even in production
  },
  test: {
    environment: "node",
  },
});
