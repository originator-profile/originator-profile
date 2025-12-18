// vite.config.ts
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        "ja/index": path.resolve(__dirname, "ja/index.html"),
        "en/index": path.resolve(__dirname, "en/index.html"),
      },
      output: {
        // assets/images の中に元のファイル名で出力
        assetFileNames: "assets/images/[name].[ext]",
      },
    },
  },
});
