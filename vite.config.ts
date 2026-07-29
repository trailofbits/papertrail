import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1300,
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
  },
});
