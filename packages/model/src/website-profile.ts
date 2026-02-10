import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { AllowedOrigin } from "./allowed-origin";
import { OpCipContext } from "./context/op-cip-context";
import { Image } from "./image";
import { OpVc } from "./op-vc";

/**
 * 後方互換性のため 2026-10-01 まで url プロパティを許容
 * @deprecated
 * @see https://github.com/originator-profile/docs.originator-profile.org/issues/451
 */
const deprecatedSubject = {
  deprecated: true,
  type: "object",
  additionalProperties: true,
  properties: {
    id: {
      type: "string",
      title: "Web サイトのオリジン (形式: https://<ホスト名>)",
      format: "uri",
    },
    type: {
      const: "WebSite",
    },
    name: {
      type: "string",
      title: "Web サイトの名称",
    },
    image: Image,
    description: {
      type: "string",
      title: "Web サイトの説明",
    },
    url: AllowedOrigin,
  },
  required: ["id", "type", "name", "url"],
} as const;

const subject = {
  type: "object",
  additionalProperties: true,
  properties: {
    id: {
      type: "string",
      description:
        "It MUST be the Web site URL. If the same content exists on multiple URLs, specify the most representative URL.",
      format: "uri",
    },
    type: {
      const: "WebSite",
    },
    name: {
      type: "string",
      description: "The name of the Web site.",
    },
    image: Image,
    description: {
      type: "string",
      description: "A description of the Web site.",
    },
    allowedOrigin: AllowedOrigin,
  },
  required: ["id", "type", "name", "allowedOrigin"],
} as const satisfies JSONSchema;

export const WebsiteProfile = {
  title: "Website Profile",
  type: "object",
  additionalProperties: true,
  allOf: [
    OpVc,
    {
      type: "object",
      properties: {
        "@context": OpCipContext,
        type: {
          type: "array",
          minItems: 2,
          items: [
            { const: "VerifiableCredential" },
            { const: "WebsiteProfile" },
          ],
        },
        credentialSubject: {
          anyOf: [deprecatedSubject, subject],
        },
      },
      required: ["@context", "type", "credentialSubject"],
    },
  ],
} as const satisfies JSONSchema;

export type WebsiteProfile = FromSchema<typeof WebsiteProfile>;
