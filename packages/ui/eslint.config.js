import originatorProfile from "eslint-config-originator-profile";

export default [
  ...originatorProfile,
  {
    files: ["**/*.tsx"],
    rules: {
      "canonical/filename-match-exported": [
        "error",
        { transformers: "pascal" },
      ],
    },
  },
];
