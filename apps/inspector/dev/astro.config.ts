import { defineConfig } from "astro/config";

// NOTE: 拡張機能側の esbuild.ts が二重起動を避けるために参照するので、待ち受けポートは
// ここを唯一の出所とする。
export const port = 8080;

export default defineConfig({
  server: {
    port,
  },
});
