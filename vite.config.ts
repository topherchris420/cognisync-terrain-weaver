import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

/** Build identity recorded in experiment exports; never fails the build. */
function codeCommit(): string {
  const fromEnv = process.env.VITE_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unrecorded";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_GIT_COMMIT": JSON.stringify(codeCommit()),
  },
  server: {
    host: "0.0.0.0",
    port: 43147,
    allowedHosts: true,
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(id))
            return "vendor-react";
          if (id.includes("node_modules/maplibre-gl/")) return "vendor-maplibre";
          if (id.includes("node_modules/@supabase/")) return "vendor-supabase";
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
}));
