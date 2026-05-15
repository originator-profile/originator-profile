import { Keys } from "@originator-profile/cryptography";
import { ContentAttestation, type Image } from "@originator-profile/model";
import {
  JwtVcVerifier,
  VcValidateFailed,
  VcValidator,
  VcVerifyFailed,
} from "@originator-profile/securing-mechanism";
import {
  FetchIntegrityResult,
  IntegrityFetchFailed,
  IntegrityVerificationFailed,
  IntegrityVerifyResult,
  verifyIntegrity as nativeVerifyIntegrity,
  verifyImageDigestSri,
  VerifyIntegrity,
} from "../integrity";
import { verifyAllowedOrigin } from "../verify-allowed-origin";
import { verifyAllowedUrl } from "../verify-allowed-url";
import { CaInvalid, CaVerifyFailed } from "./errors";
import { CaVerificationResult, VerifiedCa } from "./types";

type IntegrityResult = {
  index: number;
  verifyResult: FetchIntegrityResult;
  expectedIntegrity: string;
};

async function checkUrlAndOrigin<T extends ContentAttestation>(
  result: VerifiedCa<T>,
  url: URL,
) {
  if (result.doc.allowedUrl && result.doc.allowedOrigin) {
    return new CaInvalid("allowedUrl and allowedOrigin are exclusive", result);
  }

  if (result.doc.allowedOrigin) {
    console.warn(
      "[OP Warning] allowedOrigin is deprecated in Content Attestation and will be removed after September 2026. " +
        "Please use allowedUrl instead. " +
        "See: https://docs.originator-profile.org/",
    );
  }

  if (
    result.doc.allowedUrl &&
    !(await verifyAllowedUrl(url.toString(), result.doc.allowedUrl))
  ) {
    return new CaVerifyFailed(
      `URL not allowed. Expected:${Array.isArray(result.doc.allowedUrl) ? result.doc.allowedUrl.join(", ") : result.doc.allowedUrl} Actual:${url}`,
      result,
    );
  }
  if (
    result.doc.allowedOrigin &&
    !verifyAllowedOrigin(url.origin, result.doc.allowedOrigin)
  ) {
    return new CaVerifyFailed(
      `Origin not allowed. Expected:${Array.isArray(result.doc.allowedOrigin) ? result.doc.allowedOrigin.join(", ") : result.doc.allowedOrigin} Actual:${url.origin}`,
      result,
    );
  }
  return result;
}

function checkIntegrityResults<T extends ContentAttestation>(
  integrityResults: IntegrityResult[],
  urlResult: VerifiedCa<T>,
): CaVerifyFailed | undefined {
  // Integrity の取得に失敗した場合
  const fetchFailedResults = integrityResults.filter(
    (r) =>
      r.verifyResult instanceof Error &&
      r.verifyResult.code === IntegrityFetchFailed.code,
  );

  if (fetchFailedResults.length > 0) {
    const failedIntegritiesMessage = fetchFailedResults
      .map((result) => {
        return `target[${result.index}] Expected: ${result.expectedIntegrity}`;
      })
      .join(", ");

    return new CaVerifyFailed(
      `Content Attestation Target integrity fetch failed for element(s): ${failedIntegritiesMessage}`,
      urlResult,
    );
  }

  // Integrityの検証に失敗した場合
  const verificationFailedResults = integrityResults.filter(
    (r) =>
      r.verifyResult instanceof Error &&
      r.verifyResult.code === IntegrityVerificationFailed.code,
  );

  if (verificationFailedResults.length > 0) {
    const failedIntegritiesMessage = verificationFailedResults
      .map((result) => {
        return `target[${result.index}] Expected: ${result.expectedIntegrity}`;
      })
      .join(", ");

    return new CaVerifyFailed(
      `Content Attestation Target integrity verification failed for element(s): ${failedIntegritiesMessage}`,
      urlResult,
    );
  }
}
/**
 * Content Attestation 検証機の作成
 * @param ca Content Attestation
 * @param keys Content Attestation の発行者の検証鍵
 * @param issuer Content Attestation の発行者
 * @param url 検証対象のURL
 * @param verifyIntegrity Target Integrity の検証器
 * @param validator バリデーター
 * @returns 検証機
 */
export function CaVerifier<T extends ContentAttestation>(
  ca: string,
  keys: Keys,
  issuer: string,
  url: URL,
  verifyIntegrity: VerifyIntegrity = nativeVerifyIntegrity,
  validator?: VcValidator<VerifiedCa<T>>,
) {
  const verifyCa = JwtVcVerifier<T>(keys, issuer, validator);
  return async (): Promise<CaVerificationResult<T>> => {
    const result = await verifyCa(ca);
    if (result instanceof VcValidateFailed) {
      return new CaInvalid("Content Attestation validate failed", result);
    }
    if (result instanceof VcVerifyFailed) {
      return new CaVerifyFailed("Content Attestation verify failed", result);
    }
    const urlResult = await checkUrlAndOrigin(result, url);
    if (urlResult instanceof Error) {
      return urlResult;
    }
    await verifyImageDigestSri(
      urlResult.doc.credentialSubject.image as Image | undefined,
    );
    if (urlResult.doc.target) {
      if (urlResult.doc.target.length === 0) {
        return new CaInvalid("Target is empty", urlResult);
      }

      const integrityResults: IntegrityResult[] = await Promise.all(
        urlResult.doc.target.map(async (t, index) => ({
          index,
          verifyResult: await verifyIntegrity(t),
          expectedIntegrity: t.integrity,
        })),
      );

      const error = checkIntegrityResults(integrityResults, urlResult);
      if (error) {
        return error;
      }

      const failedIndices = integrityResults
        .filter(
          (result) =>
            !(result.verifyResult instanceof Error) &&
            !result.verifyResult.valid,
        )
        .map((result) => result.index);

      if (failedIndices.length > 0) {
        const failedIntegritiesMessage = failedIndices
          .map((integrityResultIndex) => {
            const integrityResult = integrityResults[integrityResultIndex];
            if (integrityResult) {
              const verifyResult =
                integrityResult.verifyResult as IntegrityVerifyResult;
              const calculatedIntegrities =
                verifyResult.failedIntegrities.join();
              return `target[${integrityResultIndex}] Expected: ${integrityResult.expectedIntegrity}, Calculated: ${calculatedIntegrities}`;
            }
            return undefined;
          })
          .join(", ");

        return new CaVerifyFailed(
          `Content Attestation Target integrity verification failed for element(s): ${failedIntegritiesMessage}`,
          urlResult,
        );
      }
    }
    return urlResult;
  };
}
