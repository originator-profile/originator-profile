import { cloudflare } from "@cloudflare/vite-plugin";
import { originatorProfile } from "@originator-profile/vite-plugin";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv("development", ".", ""),
    ...loadEnv(mode, ".", ""),
  };

  return {
    base: "./",
    environments: {
      client: {
        build: {
          rollupOptions: {
            input: {
              "ja/index": resolve(import.meta.dirname, "ja/index.html"),
              "en/index": resolve(import.meta.dirname, "en/index.html"),
            },
          },
        },
      },
    },
    plugins: [
      originatorProfile({
        issuers: {
          "dns:demo.exp.originator-profile.org": env.SIGNING_KEY_DEMO,
          "dns:another-originator.exp.originator-profile.org":
            env.SIGNING_KEY_ANOTHER,
        },
      }),
      cloudflare(),
    ],
  };
});
