import { z } from "zod";
import { OriginatorProfile } from "./originator-profile-set";

export const SiteProfile = z.looseObject({
  originators: z.array(OriginatorProfile).min(1),
  sites: z
    .array(z.string().describe("Website Profile"))
    .optional()
    .describe("An array of Website Profile"),
  /** @deprecated 後方互換性のため 2026-11-01 まで許容。sites が優先され、存在しない場合に credential を使用。 */
  credential: z
    .string()
    .optional()
    .describe(
      "@deprecated 後方互換性のため 2026-11-01 まで許容。sites が優先され、存在しない場合に credential を使用。",
    ),
});

export type SiteProfile = z.infer<typeof SiteProfile>;

export default SiteProfile;
