// @ts-check
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import canonicalPlugin from "eslint-plugin-canonical";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
// @ts-expect-error types not provided
import reactConfig from "eslint-plugin-react/configs/recommended.js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist/", "dist-*/", "playwright-report/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  ...fixupConfigRules([reactConfig]),
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      canonical: fixupPluginRules(canonicalPlugin),
      vitest,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...vitest.configs.recommended.rules,
      "canonical/filename-match-exported": ["error", { transforms: "kebab" }],
      "react/react-in-jsx-scope": "off",
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["dialog"] }],
      // Possible Problems
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          caughtErrors: "none",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "array-callback-return": "error",
      "no-await-in-loop": "error",
      "no-constructor-return": "error",
      "no-duplicate-imports": "error",
      "no-promise-executor-return": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-unmodified-loop-condition": "error",
      "no-unreachable-loop": "error",
      "no-unused-private-class-members": "error",
      "no-use-before-define": "error",
      "require-atomic-updates": "error",
      //==================== recommendedTypeChecked
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": "off",
      //===================================
      // Best Practices
      eqeqeq: "error",
      "no-var": "error",
      "max-depth": ["error", 2],
      complexity: ["error", 10],
    },
  },
  {
    files: ["eslint.config.{js,ts}"],
    rules: {
      "canonical/filename-match-exported": "off",
    },
  },
  {
    rules: {
      // FIXME: v7.0.0 には不具合があるので無効化
      // Bug: eslint-react-hooks false positives on refs rule
      // https://github.com/facebook/react/issues/34775
      "react-hooks/refs": "off",
    },
  },
];
