import { FromSchema, JSONSchema } from "json-schema-to-ts";

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
      // NOTE: 後方互換性のため単数形も許容。将来的には配列のみに移行予定
      oneOf: [
        {
          type: "string",
          title: "Web Media Profile",
        },
        {
          type: "array",
          items: {
            type: "string",
            title: "Web Media Profile",
          },
        },
      ],
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
