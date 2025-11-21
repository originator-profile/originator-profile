import type { FromSchema, JSONSchema } from "json-schema-to-ts";

export const RawTarget = {
  type: "object",
  description: "未加工のターゲット",
  properties: {
    type: {
      type: "string",
      description: "Target Integrityの種別 (e.g., TextTargetIntegrity)",
      enum: [
        "TextTargetIntegrity",
        "VisibleTextTargetIntegrity",
        "HtmlTargetIntegrity",
        "ExternalResourceTargetIntegrity",
      ],
    },
    content: {
      anyOf: [
        {
          type: "array",
          items: {
            type: "string",
            description: "コンテンツ本体 (text/html or URL)",
          },
        },
        {
          type: "string",
          description: "コンテンツ本体 (text/html or URL)",
        },
      ],
    },
    cssSelector: {
      type: "string",
      description: "CSS セレクター (optional)",
    },
  },
  required: ["type"],
  additionalProperties: true,
} as const satisfies JSONSchema;

/** 未加工のターゲット */
export type RawTarget = FromSchema<typeof RawTarget>;
