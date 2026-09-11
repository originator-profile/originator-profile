import chokidar from "chokidar";
import dotenv from "dotenv";
import path from "node:path";
import util from "node:util";

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
      return `chromium|firefox-desktop (default: ${this.default})`;
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
const outdir = path.join(import.meta.dirname, `dist-${args.values.target}`);

const registryOps: { core: string; annotations?: string[]; media?: string }[] =
  process.env.REGISTRY_OPS ? JSON.parse(process.env.REGISTRY_OPS) : [];

const env = {
  MODE: args.values.mode,
};

if (registryOps.length === 0) {
  console.warn(
    "REGISTRY_OPS is empty. Please set REGISTRY_OPS environment variable.",
  );
}

import * as astro from "astro";
import esbuild from "esbuild";
import copy from "esbuild-copy-static-files";
import { rm, writeFile } from "node:fs/promises";
import { port as devSitePort } from "./dev/astro.config.ts";
// @ts-expect-error: 型定義がない
import webExt from "web-ext";
import postcss from "./esbuild.postcss.ts";
import manifest from "./manifest.ts";

const buildOptions = {
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
    {
      // OPS（VC/JWT）はコードへバンドルせず、拡張機能ルートへ別ファイルとして
      // 配置し、実行時に chrome.runtime.getURL 経由で読み込む（難読化ポリシー対応）
      name: "plugin:registry-ops",
      setup(build) {
        const dist = build.initialOptions.outdir ?? ".";
        build.onEnd(async () => {
          await writeFile(
            path.join(dist, "registry-ops.json"),
            JSON.stringify(registryOps),
          );
        });
      },
    },
  ],
} as const satisfies esbuild.BuildOptions;

await rm(outdir, {
  force: true,
  recursive: true,
});

await esbuild.build(buildOptions);

const watch = Boolean(args.values.mode === "development" && args.values.url);

// NOTE: もう一方の拡張機能の pnpm dev が検証用サイトを既に立てていることがある。
async function isDevSiteRunning(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

if (watch) {
  const devSiteUrl = `http://localhost:${devSitePort}`;
  const running = await isDevSiteRunning(devSiteUrl);
  if (running) {
    console.log(`reusing the dev site already running at ${devSiteUrl}`);
  }
  const devServer = running ? undefined : await astro.dev({ root: "dev" });
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
  await devServer?.stop();
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
