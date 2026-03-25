import { z } from "zod";

export const OriginatorProfileSetItem = z.looseObject({
  core: z.string().describe("Core Profile"),
  annotations: z
    .array(z.string().describe("Profile Annotation"))
    .optional()
    .describe("An array of Profile Annotation"),
  /**
   * 後方互換性のため 2026-11-01 まで非配列 WMP の OP を許容
   * @deprecated z.string() の受け入れは非推奨。代わりに z.array(z.string()) を使用してください。
   */
  media: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Web Media Profile or an array of Web Media Profile"),
});

export const OriginatorProfileSet = z.array(OriginatorProfileSetItem);

export type OriginatorProfileSetItem = z.infer<typeof OriginatorProfileSetItem>;
export type OriginatorProfileSet = z.infer<typeof OriginatorProfileSet>;

export default OriginatorProfileSet;
