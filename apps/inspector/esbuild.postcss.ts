import type { Plugin } from "esbuild";
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import postcssrc from "postcss-load-config";

export default {
  name: "postcss",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
      const { plugins, options } = await postcssrc();
      const css = await readFile(path, "utf8");
      return postcss(plugins)
        .process(css, { ...options, from: path })
        .then(
          (result) => ({ loader: "css" as const, contents: result.css }),
          (error) => ({ errors: [{ detail: error }] }),
        );
    });
  },
} satisfies Plugin;
