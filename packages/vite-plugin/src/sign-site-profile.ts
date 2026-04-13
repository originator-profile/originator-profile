import type {
  Jwk,
  RawImage,
  UnsignedWebsiteProfile,
} from "@originator-profile/model";
import { WebsiteProfile } from "@originator-profile/opvc";
import { resolveKey, resolveLocalContent } from "./resolve-content";

export interface SiteProfileInput {
  originators: unknown[];
  sites: UnsignedWebsiteProfile[];
}

export interface SiteProfileOutput {
  originators: unknown[];
  sites: string[];
}

export interface SigningContext {
  issuers: Record<string, Jwk>;
  issuedAt: Date;
  expiredAt: Date;
}

export async function signSiteProfile(
  input: SiteProfileInput,
  ctx: SigningContext,
  baseDir: string,
): Promise<SiteProfileOutput> {
  const signedSites = await Promise.all(
    input.sites.map(async (uwsp) => {
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
