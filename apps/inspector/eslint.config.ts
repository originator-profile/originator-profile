import originatorProfile from "eslint-config-originator-profile";
import globals from "globals";

export default [
  ...originatorProfile,
  {
    ignores: ["dev/**/*"],
  },
  {
    files: ["esbuild.ts", "esbuild.*.ts", "postcss.config.ts"],
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
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    files: ["manifest.ts"],
    rules: {
      "canonical/filename-match-exported": "off",
    },
  },
];
