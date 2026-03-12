import { CertificationSystem } from "@originator-profile/model";
import { CertificationSystemValidationFailed } from "./errors";

/**
 * 認証制度の検証
 * @param payload ペイロード
 * @return 検証結果
 */
export function validateCertificationSystem(
  payload: unknown,
): CertificationSystem | CertificationSystemValidationFailed {
  const result = CertificationSystem.safeParse(payload);
  if (!result.success) {
    return new CertificationSystemValidationFailed(result.error.message, {
      payload,
    });
  }
  return result.data;
}
