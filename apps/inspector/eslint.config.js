import originatorProfile from "eslint-config-originator-profile";
import globals from "globals";

export default [
  ...originatorProfile,
  {
    ignores: ["dev/**/*"],
  },
  {
    files: ["esbuild.js", "esbuild.*.js", "postcss.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "canonical/filename-match-exported": [
        "error",
        { transformers: "pascal" },
      ],
    },
  },
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "require-atomic-updates": "off",
      "react-hooks/rules-of-hooks": "off", // NOTE: TestFixture -> use() の検出を回避
    },
  },
  {
    files: ["manifest.js"],
    rules: {
      "canonical/filename-match-exported": "off",
    },
  },
];
