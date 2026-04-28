import { cloudflare } from "@cloudflare/vite-plugin";
import { originatorProfile } from "@originator-profile/vite-plugin";
import { resolve } from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv("development", ".", ""),
    ...loadEnv(mode, ".", ""),
    ...process.env,
  };

  return {
    base: "./",
    environments: {
      client: {
        build: {
          rollupOptions: {
            input: {
              "en": resolve(import.meta.dirname, "en/index.html"),
              "en/ad-iframe-demo": resolve(import.meta.dirname, "en/ad-iframe-demo.html"),
              "ja": resolve(import.meta.dirname, "ja/index.html"),
              "ja/ad-iframe-demo": resolve(import.meta.dirname, "ja/ad-iframe-demo.html"),
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
          "dns:ad.oprexpt.example": env.SIGNING_KEY_AD,
        },
      }),
      cloudflare(),
    ],
  };
});
