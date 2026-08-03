import Icons from "unplugin-icons/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // `~icons/{collection}/{icon}` import をテスト実行時にも解決するための設定。
  // apps/inspector 側の esbuild.ts と揃える(scale: 1 は @iconify/react 互換の既定サイズ)。
  plugins: [Icons({ compiler: "jsx", jsx: "react", scale: 1 })],
  test: {
    dir: "src",
    passWithNoTests: true,
  },
});
