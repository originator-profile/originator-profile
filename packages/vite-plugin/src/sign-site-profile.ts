import {
  UnsignedWebsiteProfile as UnsignedWebsiteProfileSchema,
  type RawImage,
  type UnsignedWebsiteProfile,
} from "@originator-profile/model";
import { WebsiteProfile } from "@originator-profile/opvc";
import { z } from "zod";
import { resolveKey, resolveLocalContent } from "./resolve-content";
import type { SigningContext } from "./types";

const OriginatorProfile = z.looseObject({
  core: z.string(),
  annotations: z.array(z.string()).optional(),
  media: z.union([z.string(), z.array(z.string())]).optional(),
});

export const SiteProfileInputSchema = z.object({
  originators: z
    .array(OriginatorProfile)
    .min(1, "originators must not be empty"),
  sites: z
    .array(UnsignedWebsiteProfileSchema)
    .min(1, "sites must not be empty"),
});

export type SiteProfileInput = z.infer<typeof SiteProfileInputSchema>;

export interface SiteProfileOutput {
  originators: SiteProfileInput["originators"];
  sites: string[];
}

export async function signSiteProfile(
  input: SiteProfileInput,
  ctx: SigningContext,
  baseDir: string,
): Promise<SiteProfileOutput> {
  const signedSites = await Promise.all(
    input.sites.map(async (originalUwsp: UnsignedWebsiteProfile) => {
      const uwsp = structuredClone(originalUwsp);
      resolveLocalContent(
        uwsp.credentialSubject.image as RawImage | undefined,
        baseDir,
      );
      const key = resolveKey(ctx.issuers, uwsp.issuer);

      return await WebsiteProfile.sign(uwsp, key, {
        issuedAt: ctx.issuedAt,
        expiredAt: ctx.expiredAt,
      });
    }),
  );

  return {
    originators: input.originators,
    sites: signedSites,
  };
}
