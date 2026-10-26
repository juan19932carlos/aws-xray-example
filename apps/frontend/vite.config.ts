import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two pages: the todos app and the trace viewer.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        traces: resolve(import.meta.dirname, "traces.html"),
      },
    },
  },
});
