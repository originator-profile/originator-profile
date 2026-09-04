import { LocalKeys } from "@originator-profile/cryptography";
import {
  ContentAttestation,
  ContentAttestationSet,
} from "@originator-profile/model";
import {
  JwtVcDecoder,
  type VcValidatorFactory,
} from "@originator-profile/securing-mechanism";
import {
  CaInvalid,
  CaVerifier,
  CaVerifyFailed,
  CoreProfileNotFound,
  VerifiedOps,
  VerifyIntegrity,
} from "../";
import { CasVerifyFailed } from "./errors";
import { normalizeCasItem } from "./normalize-cas-item";
import { CasVerificationResult, VerifiedCas } from "./types";

/**
 * Content Attestation Set の検証
 * @param cas Content Attestation Set
 * @param verifiedOps 検証済み Originator Profile Set
 * @param url 検証対象のURL
 * @param verifyIntegrity Target Integrity の検証器
 * @param validator バリデーター
 * @returns CAS 検証結果
 *
 * @example
 * ```ts
 * import { verifyIntegirty } from "@originator-profile/verify";
 *
 * const cas = ["eyJ...", { main: true, attestation: "eyJ..." }];
 * const verifiedOps; // VerifiedOps
 * const url = location.href;
 * const verified = await verifyCas(cas, verifiedOps, url, verifyIntegrity);
 * if (verified instanceof Error) {
 *   verified; // CasVerifyFailed
 *   process.exit(1);
 * }
 * verified; // VerifiedCas
 * ```
 */
export async function verifyCas<
  T extends ContentAttestation = ContentAttestation,
>(
  cas: ContentAttestationSet,
  verifiedOps: VerifiedOps,
  url: string,
  verifyIntegrity: VerifyIntegrity,
  validator?: VcValidatorFactory,
): Promise<CasVerificationResult<T>> {
  const decodeCa = JwtVcDecoder<ContentAttestation>();
  const resultCas = await Promise.all(
    cas.map(async (ca) => {
      const { main, attestation: source } = normalizeCasItem(ca);
      const decodedCa = decodeCa(source);
      if (decodedCa instanceof Error) {
        return { main, attestation: new CaInvalid("Invalid CA", decodedCa) };
      }
      const cp = verifiedOps.find(
        (ops) => ops.core.doc.credentialSubject.id === decodedCa.doc.issuer,
      );
      if (!cp) {
        return {
          main,
          attestation: new CoreProfileNotFound(
            "Appropriate Core Profile not found",
            decodedCa,
          ),
        };
      }
      const verify = CaVerifier<T>(
        source,
        LocalKeys(cp.core.doc.credentialSubject.jwks),
        decodedCa.doc.issuer,
        new URL(url),
        verifyIntegrity,
        validator?.(ContentAttestation),
      );
      return { main, attestation: await verify() };
    }),
  );
  if (
    resultCas.some((ca) => {
      return (
        ca.attestation instanceof CaInvalid ||
        ca.attestation instanceof CoreProfileNotFound ||
        ca.attestation instanceof CaVerifyFailed
      );
    })
  ) {
    return new CasVerifyFailed(
      "Content Attestation Set verify failed",
      resultCas,
    );
  }
  return resultCas as VerifiedCas<T>;
}
