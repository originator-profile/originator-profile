import { z } from "zod";
import { OriginatorProfile } from "./originator-profile-set";

export const SiteProfile = z.looseObject({
  originators: z.array(OriginatorProfile).min(1),
  sites: z
    .array(z.string().describe("Website Profile"))
    .optional()
    .describe("An array of Website Profile"),
  credential: z.string().optional().describe("Credential"),
});

export type SiteProfile = z.infer<typeof SiteProfile>;

export default SiteProfile;
