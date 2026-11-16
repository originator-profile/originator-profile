import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli/help.ts", "src/commands/**/*.ts"],
  clean: true,
  dts: true,
  fixedExtension: false,
});
