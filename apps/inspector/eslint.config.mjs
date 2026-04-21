import originatorProfile from "eslint-config-originator-profile";
import globals from "globals";

export default [
  ...originatorProfile,
  {
    ignores: ["dev/**/*"],
  },
  {
    files: ["postcss.config.cjs", "tailwind.config.cjs", "esbuild.*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["esbuild.mjs"],
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
    files: ["manifest.mjs"],
    rules: {
      "canonical/filename-match-exported": "off",
    },
  },
];
