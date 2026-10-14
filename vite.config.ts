import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

process.env.TZ = "Pacific/Auckland";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:8080",
          changeOrigin: false,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["src/test/setup.ts"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "verification/**",
        "**/e2e/**",
      ],
      coverage: {
        provider: "v8",
        thresholds: {
          lines: 80,
          branches: 75,
        },
        exclude: ["src/main.tsx", "e2e/**"],
      },
    },
  };
});
