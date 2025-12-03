import type { FromSchema, JSONSchema } from "json-schema-to-ts";

export const Page = {
    title: "ページ",
    type: "object",
    properties: {
        id: { title: "ページ URL", type: "string", format: "uri" },
        name: { title: "ページ表示名", type: "string" }
    },
    required: ["id", "name"],
} as const satisfies JSONSchema;

export type Page = FromSchema<typeof Page>;