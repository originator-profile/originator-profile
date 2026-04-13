// vite.config.ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { originatorProfile } from "@originator-profile/vite-plugin";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");

  return {
    base: "./",
    environments: {
      client: {
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
      },
    },
    plugins: [
      originatorProfile({
        issuers: {
          "dns:demo.exp.originator-profile.org":
            env.VITE_SIGNING_KEY_DEMO,
          "dns:another-originator.exp.originator-profile.org":
            env.VITE_SIGNING_KEY_ANOTHER,
        },
      }),
      cloudflare(),
    ],
  };
});
