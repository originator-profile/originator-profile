import { z } from "zod";

export const OriginatorProfile = z.looseObject({
  core: z.string().describe("Core Profile"),
  annotations: z
    .array(z.string().describe("Profile Annotation"))
    .optional()
    .describe("An array of Profile Annotation"),
  /** @deprecated 後方互換性のため 2026-11-01 まで非配列 WMP を許容。代わりに配列を使用してください。 */
  media: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      `\
An array of Web Media Profile

@deprecated 後方互換性のため 2026-11-01 まで非配列 WMP を許容。代わりに配列を使用してください。
`,
    ),
});

export const OriginatorProfileSet = z.array(OriginatorProfile);

export type OriginatorProfile = z.infer<typeof OriginatorProfile>;
export type OriginatorProfileSet = z.infer<typeof OriginatorProfileSet>;

export default OriginatorProfileSet;
