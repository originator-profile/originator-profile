import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { OriginatorProfileSetItem } from "./originator-profile-set";

export const SiteProfile = {
  title: "Site Profile",
  type: "object",
  additionalProperties: true,
  properties: {
    originators: {
      type: "array",
      items: OriginatorProfileSetItem,
      minItems: 1,
    },
    sites: {
      title: "Website Profile の配列",
      type: "array",
      items: {
        type: "string",
        title: "Website Profile",
      },
    },
    credential: {
      // NOTE: 後方互換性のため 2026-11-01 まで残す。sitesが優先され、存在しない場合にcredentialを使用
      type: "string",
      title: "Credential",
    },
  },
  required: ["originators"],
} as const satisfies JSONSchema;

export type SiteProfile = FromSchema<typeof SiteProfile>;

export default SiteProfile;
