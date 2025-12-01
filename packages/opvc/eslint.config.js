import originatorProfile from "eslint-config-originator-profile";

export default [
  ...originatorProfile,
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "vitest/no-import-node-test": "off",
      "no-await-in-loop": "off",
    },
  },
];
