import {
  Certificate as CertificateSchema,
  JapaneseExistenceCertificate,
  JapaneseExistencePA,
  ProfileAnnotation,
} from "@originator-profile/model";
import {
  UnverifiedJwtVc,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { z } from "zod";
import { verifyImageDigestSri } from "../integrity";
import { type MappedKeys } from "../keys";
import { CertificateExpired } from "./errors";
import { OpVerifier } from "./op-verifier";
import type { Certificate } from "./types";

function validateCertificateExpiry<T extends Certificate>(
  verifiedVc: VerifiedJwtVc<T>,
): VerifiedJwtVc<T> | CertificateExpired<T> {
  const now = new Date();
  const validFrom = verifiedVc.doc.validFrom
    ? new Date(verifiedVc.doc.validFrom)
    : null;
  const validUntil = verifiedVc.doc.validUntil
    ? new Date(verifiedVc.doc.validUntil)
    : null;

  if (validFrom && now < validFrom) {
    return new CertificateExpired("Certificate not yet valid", verifiedVc);
  }
  if (validUntil && now > validUntil) {
    return new CertificateExpired("Certificate expired", verifiedVc);
  }

  return verifiedVc;
}

/** annotations プロパティの署名検証 */
export async function verifyAnnotations(
  paIssuerKeys: MappedKeys,
  annotations?: UnverifiedJwtVc<Certificate>[],
  validator?: typeof VcValidator,
) {
  if (!annotations) return;
  return await Promise.all(
    annotations.map(async (annotation) => {
      const verify = OpVerifier<Certificate>(
        paIssuerKeys,
        annotation,
        validator?.(
          z.union([
            JapaneseExistencePA,
            ProfileAnnotation,
            JapaneseExistenceCertificate,
            CertificateSchema,
          ]),
        ),
      );

      const result = await verify(annotation.source);
      if (result instanceof Error) {
        return result;
      }

      const valid = validateCertificateExpiry(result);
      if (valid instanceof CertificateExpired) {
        return valid;
      }

      await verifyImageDigestSri(valid.doc.credentialSubject.image);

      return valid;
    }),
  );
}
