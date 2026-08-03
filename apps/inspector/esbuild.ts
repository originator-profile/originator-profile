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

const credentials: ImportMeta["env"]["BASIC_AUTH_CREDENTIALS"] = process.env
  .BASIC_AUTH_CREDENTIALS
  ? JSON.parse(process.env.BASIC_AUTH_CREDENTIALS)
  : [];

const registryOps: { core: string; annotations?: string[]; media?: string }[] =
  process.env.REGISTRY_OPS ? JSON.parse(process.env.REGISTRY_OPS) : [];

const env = {
  MODE: args.values.mode,
  BASIC_AUTH: process.env.BASIC_AUTH === "true",
  BASIC_AUTH_CREDENTIALS: process.env.BASIC_AUTH === "true" ? credentials : [],
};

if (env.BASIC_AUTH && env.BASIC_AUTH_CREDENTIALS.length === 0) {
  throw new Error(
    "BASIC_AUTH is enabled but BASIC_AUTH_CREDENTIALS is not set. Please set BASIC_AUTH_CREDENTIALS environment variable.",
  );
}

if (registryOps.length === 0) {
  console.warn(
    "REGISTRY_OPS is empty. Please set REGISTRY_OPS environment variable.",
  );
}

import * as astro from "astro";
import esbuild from "esbuild";
import copy from "esbuild-copy-static-files";
import { rm, writeFile } from "node:fs/promises";
import Icons from "unplugin-icons/esbuild";
// @ts-expect-error: 型定義がない
import webExt from "web-ext";
import postcss from "./esbuild.postcss.ts";
import manifest from "./manifest.ts";

// unplugin-icons が生成する `~icons/{collection}/{icon}` 仮想モジュールは、
// unplugin の esbuild アダプタ内部で `path.dirname(仮想パス)` を resolveDir として
// 返すため、実在しない相対パスになり react / react/jsx-runtime の解決に失敗する
// (esbuild は絶対パスの resolveDir のみ node_modules を辿れる)。
// そのため、resolveDir が相対パスの場合はビルドの作業ディレクトリに補正する。
// build.onLoad の差し替えは対象プラグインの setup() 実行中のみに限定し、
// 完了後は元に戻すことで、後続に登録される他のプラグイン(postcss, manifest 等)の
// onLoad には影響を与えないようにする。
function withAbsoluteResolveDir(plugin: esbuild.Plugin): esbuild.Plugin {
  return {
    name: plugin.name,
    async setup(build) {
      const originalOnLoad = build.onLoad.bind(build);
      build.onLoad = (options, callback) => {
        originalOnLoad(options, async (args) => {
          const result = await callback(args);
          if (result?.resolveDir && !path.isAbsolute(result.resolveDir)) {
            return {
              ...result,
              resolveDir: build.initialOptions.absWorkingDir ?? process.cwd(),
            };
          }
          return result;
        });
      };
      try {
        await plugin.setup(build);
      } finally {
        build.onLoad = originalOnLoad;
      }
    },
  };
}

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
    // scale: 1 は @iconify/react の既定サイズ(1em)と揃えるための指定
    // (unplugin-icons の既定値は 1.2)。
    withAbsoluteResolveDir(
      Icons({
        compiler: "jsx",
        jsx: "react",
        scale: 1,
      }),
    ),
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
