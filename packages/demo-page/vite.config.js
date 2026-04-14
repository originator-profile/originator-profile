import { cloudflare } from "@cloudflare/vite-plugin";
import { originatorProfile } from "@originator-profile/vite-plugin";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    base: "./",
    environments: {
      client: {
        build: {
          rollupOptions: {
            input: {
              "ja/index": resolve(dirname, "ja/index.html"),
              "en/index": resolve(dirname, "en/index.html"),
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
