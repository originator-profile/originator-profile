import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/commands/**/*.ts"],
});
