import { FromSchema, JSONSchema } from "json-schema-to-ts";

export const CertificationSystem = {
  type: "object",
  title: "認証システム",
  properties: {
    id: {
      type: "string",
      title: "認証システムの ID",
      format: "uri",
    },
    type: {
      type: "string",
      title: "認証システムの種類",
      const: "CertificationSystem",
    },
    name: { type: "string", title: "認証システム名" },
    description: { type: "string", title: "説明" },
    ref: {
      type: "string",
      title: "認証制度の詳細ページ",
      description:
        "認証制度の詳細を知るための人が読むためのページの URL です。",
      format: "uri",
    },
  },
  required: ["id", "type", "name"],
} as const satisfies JSONSchema;

export type CertificationSystem = FromSchema<typeof CertificationSystem>;
