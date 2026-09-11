import { defineConfig } from "astro/config";

// NOTE: 待ち受けポートはここを唯一の出所とする。拡張機能側の esbuild.ts が参照している。
export const port = 8080;

export default defineConfig({
  server: {
    port,
  },
});
