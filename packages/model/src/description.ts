import { FromSchema, JSONSchema } from "json-schema-to-ts";

export const Description = {
  title: "Description",
  anyOf: [
    { type: "string" },
    {
      type: "object",
      additionalProperties: true,
      properties: {
        text: {
          type: "string",
          description: "Text value.",
        },
        encodingFormat: {
          type: "string",
          title: "Encoding format",
          description:
            "MIME type. Allowed values: 'text/plain' and 'text/html' (only br, p, ol, ul, li allowed).",
          enum: ["text/plain", "text/html"],
        },
      },
      required: ["text", "encodingFormat"],
    },
  ],
} as const satisfies JSONSchema;

export type Description = FromSchema<typeof Description>;
