import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  plugins: [react()],
  define: {
    // Excalidraw's bundle references this; without it the prod build throws
    // "process is not defined" at runtime (dev works fine — classic deploy-only break).
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  build: {
    // Excalidraw + mermaid are large; raise the warn limit so real problems stand out.
    chunkSizeWarningLimit: 2500,
    sourcemap: false,
  },
});
