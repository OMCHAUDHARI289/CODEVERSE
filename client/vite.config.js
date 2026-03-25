import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = Number(env.VITE_DEV_PORT) || 5173;
  const proxyTarget =
    env.VITE_API_PROXY_TARGET || env.VITE_API_BASE || "http://127.0.0.1:5000";

  return {
    plugins: [react()],
    server: {
      port: devPort,
      proxy: {
        "/api": proxyTarget
      }
    }
  };
});
