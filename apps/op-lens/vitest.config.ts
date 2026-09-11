import { defineConfig } from "vitest/config";

export default defineConfig({
  ssr: {
    resolve: {
      conditions: ["browser"],
    },
  },
  test: {
    dir: "src",
    pool: "forks",
  },
});
