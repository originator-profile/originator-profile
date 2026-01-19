import { FromSchema, JSONSchema } from "json-schema-to-ts";

/**
 * 後方互換性のため 2026-11-01 まで非配列 WMP の OP を許容
 * @deprecated
 */
const deprecatedMedia = {
  type: "string",
  title: "Web Media Profile",
} as const satisfies JSONSchema;

const mediaArray = {
  type: "array",
  items: {
    type: "string",
    title: "Web Media Profile",
  },
} as const satisfies JSONSchema;

/** TODO: OriginatorProfile に名前変更 */
export const OriginatorProfileSetItem = {
  title: "Originator Profile",
  type: "object",
  additionalProperties: true,
  properties: {
    core: {
      title: "Core Profile",
      type: "string",
    },
    annotations: {
      title: "Profile Annotation の配列",
      type: "array",
      items: {
        type: "string",
        title: "Profile Annotation",
      },
    },
    media: {
      title: "Web Media Profile または Web Media Profile の配列",
      oneOf: [deprecatedMedia, mediaArray],
    },
  },
  required: ["core"],
} as const satisfies JSONSchema;

export const OriginatorProfileSet = {
  title: "Originator Profile Set",
  type: "array",
  items: OriginatorProfileSetItem,
} as const satisfies JSONSchema;

export type OriginatorProfileSetItem = FromSchema<
  typeof OriginatorProfileSetItem
>;
export type OriginatorProfileSet = FromSchema<typeof OriginatorProfileSet>;

export default OriginatorProfileSet;
