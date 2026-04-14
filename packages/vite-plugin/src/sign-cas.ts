import type {
  RawImage,
  RawTarget,
  UnsignedContentAttestation,
} from "@originator-profile/model";
import { ContentAttestation } from "@originator-profile/opvc";
import { resolveKey, resolveLocalContent } from "./resolve-content";
import type { SigningContext } from "./types";

export type CasOutput = string | { attestation: string; main: true };

const DOM_TARGET_TYPES = new Set([
  "HtmlTargetIntegrity",
  "TextTargetIntegrity",
  "VisibleTextTargetIntegrity",
]);

export async function signCas(
  entries: Array<UnsignedContentAttestation & { main?: boolean }>,
  ctx: SigningContext,
  baseDir: string,
  html?: string,
): Promise<CasOutput[]> {
  const htmlDataUrl = html
    ? `data:text/html,${encodeURIComponent(html)}`
    : undefined;

  return await Promise.all(
    entries.map(async (entry) => {
      const { main, ...uca } = entry;

      resolveLocalContent(
        uca.credentialSubject.image as RawImage | undefined,
        baseDir,
      );
      for (const target of uca.target) {
        resolveLocalContent(target as RawTarget, baseDir);

        if (
          htmlDataUrl &&
          DOM_TARGET_TYPES.has(target.type) &&
          !target.integrity &&
          !target.content
        ) {
          (target as RawTarget).content = htmlDataUrl;
        }
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
