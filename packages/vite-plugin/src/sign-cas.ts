import type {
  Jwk,
  RawImage,
  RawTarget,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import { ContentAttestation } from "@originator-profile/opvc";
import { resolveKey, resolveLocalContent } from "./resolve-content";

export type CasOutput = string | { attestation: string; main: true };

export interface SigningContext {
  issuers: Record<string, Jwk>;
  issuedAt: Date;
  expiredAt: Date;
}

export async function signCas(
  entries: Array<UnsignedContentAttestation & { main?: boolean }>,
  ctx: SigningContext,
  baseDir: string,
): Promise<CasOutput[]> {
  return await Promise.all(
    entries.map(async (entry) => {
      const { main, ...uca } = entry;

      resolveLocalContent(
        uca.credentialSubject.image as RawImage | undefined,
        baseDir,
      );
      for (const target of uca.target) {
        resolveLocalContent(target as RawTarget, baseDir);
      }

      const key = resolveKey(ctx.issuers, uca.issuer);
      const jwt = await ContentAttestation.sign(
        uca as UnsignedContentAttestation,
        key,
        { issuedAt: ctx.issuedAt, expiredAt: ctx.expiredAt },
      );

      return main ? { attestation: jwt, main: true as const } : jwt;
    }),
  );
}
