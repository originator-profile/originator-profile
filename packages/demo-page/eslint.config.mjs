import originatorProfile from "eslint-config-originator-profile";
import globals from "globals";

export default [
  ...originatorProfile,
  {
    files: ["vite.config.ts"],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
  },
];
