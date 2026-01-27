import { FromSchema } from "json-schema-to-ts";

export const OpMeta = {
  title: "Op Meta",
  type: "object",
  properties: {
    targetopid: {
      type: "string",
    },
  },
  required: ["targetopid"],
  additionalProperties: true,
} as const;

export type OpMeta = FromSchema<typeof OpMeta>;
