const postcssrc = require("postcss-load-config");
const postcss = require("postcss");
const { readFile } = require("fs").promises;

module.exports = {
  name: "postcss",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
      const { plugins, options } = await postcssrc();
      const css = await readFile(path, "utf8");
      return postcss(plugins)
        .process(css, { ...options, from: path })
        .then(
          (result) => ({ loader: "css", contents: result.css }),
          (error) => ({ errors: [{ detail: error }] }),
        );
    });
  },
};
