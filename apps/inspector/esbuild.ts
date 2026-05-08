import * as astro from "astro";
import chokidar from "chokidar";
import dotenv from "dotenv";
import esbuild from "esbuild";
import copy from "esbuild-copy-static-files";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import util from "node:util";
// @ts-expect-error: 型定義がない
import webExt from "web-ext";
import postcss from "./esbuild.postcss.ts";
import manifest from "./manifest.ts";

const options = {
  mode: {
    type: "string",
    default: process.env.NODE_ENV || "production",
    toString() {
      return `production|development|testing (default: ${this.default})`;
    },
  },
  target: {
    type: "string",
    short: "t",
    default: "chromium",
    toString() {
      return `chromium|firefox-desktop|firefox-android (default: ${this.default})`;
    },
  },
  url: {
    type: "string",
    short: "u",
    default: "http://localhost:8080",
    toString() {
      return `<watch_url> (default: ${this.default}, development mode only)`;
    },
  },
  help: {
    type: "boolean",
    short: "h",
    run() {
      console.log(
        [
          "Available options:",
          ...Object.entries(options).map((option) =>
            [
              `  --${option[0]}`,
              "short" in option[1] && ` -${option[1].short}`,
              option[1].type === "string" && `=${option[1].toString()}`,
            ]
              .filter(Boolean)
              .join(""),
          ),
        ].join("\n"),
      );
    },
  },
} as const;

const args = util.parseArgs({ options });

if (args.values.help) {
  options.help.run();
  process.exit();
}

dotenv.config({ path: [".env", `.env.${args.values.mode}`] });

const filename = `{name}-${args.values.target}-{version}.zip`;
const artifactsDir = "web-ext-artifacts";
const cwd = path.dirname(fileURLToPath(new URL(import.meta.url)));
const outdir = path.join(cwd, `dist-${args.values.target}`);

const credentials: ImportMeta["env"]["BASIC_AUTH_CREDENTIALS"] = process.env
  .BASIC_AUTH_CREDENTIALS
  ? JSON.parse(process.env.BASIC_AUTH_CREDENTIALS)
  : [];

const env = {
  MODE: args.values.mode,
  BASIC_AUTH: process.env.BASIC_AUTH === "true",
  BASIC_AUTH_CREDENTIALS: process.env.BASIC_AUTH === "true" ? credentials : [],
  REGISTRY_OPS: process.env.REGISTRY_OPS
    ? JSON.parse(process.env.REGISTRY_OPS)
    : [],
};

if (env.BASIC_AUTH && env.BASIC_AUTH_CREDENTIALS.length === 0) {
  throw new Error(
    "BASIC_AUTH is enabled but BASIC_AUTH_CREDENTIALS is not set. Please set BASIC_AUTH_CREDENTIALS environment variable.",
  );
}

if (env.REGISTRY_OPS.length === 0) {
  console.warn(
    "REGISTRY_OPS is empty. Please set REGISTRY_OPS environment variable.",
  );
}

const buildOptions: esbuild.BuildOptions = {
  target: "es2018",
  entryPoints: [
    "src/main.tsx",
    "src/background.ts",
    "src/content-script.ts",
    "src/content-script/iframe.tsx",
    "src/content-script-all-frames.ts",
  ],
  outdir,
  color: true,
  bundle: true,
  minify: args.values.mode === "production",
  sourcemap: ["development", "testing"].includes(args.values.mode ?? ""),
  conditions: ["browser"],
  define: {
    "import.meta.env": JSON.stringify(env),
  },
  jsx: "automatic",
  loader: {
    ".png": "dataurl",
    ".svg": "dataurl",
  },
  plugins: [
    copy({
      src: "public",
      dest: outdir,
    }),
    postcss,
    manifest({
      target: args.values.target,
      mode: args.values.mode,
    }),
  ],
};

await rm(outdir, {
  force: true,
  recursive: true,
});

await esbuild.build(buildOptions);

const watch = Boolean(args.values.mode === "development" && args.values.url);

if (watch) {
  const devServer = await astro.dev({ root: "dev" });
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("watching...");
  const watcher = chokidar.watch("./public");
  watcher
    .on("add", (path) => {
      console.log(`File ${path} has been added`);
      void ctx.rebuild();
    })
    .on("change", (path) => {
      console.log(`File ${path} has been changed`);
      void ctx.rebuild();
    })
    .on("unlink", (path) => {
      console.log(`File ${path} has been removed`);
      void ctx.rebuild();
    });

  const runner = await webExt.cmd.run({
    target: args.values.target,
    sourceDir: outdir,
    startUrl: args.values.url,
  });
  await new Promise((r) => {
    runner.registerCleanup(() => r(1));
  });
  await devServer.stop();
} else {
  await webExt.cmd.build({
    target: args.values.target,
    sourceDir: outdir,
    filename,
    artifactsDir,
    overwriteDest: true,
  });
}

process.exit();
