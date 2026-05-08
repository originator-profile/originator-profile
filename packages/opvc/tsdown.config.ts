import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/commands/**/*.ts"],
  clean: true,
  dts: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
