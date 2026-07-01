import {
  Certificate,
  isProfileAnnotationIssuerRegistration,
} from "@originator-profile/verify";

/**
 * Profile Annotation Issuer 登録証 PA は inspector に表示しない。
 * 後方互換性のために非表示のままとしている。
 */
export function isDisplayableProfileAnnotation(
  certificate: Certificate,
): boolean {
  return !isProfileAnnotationIssuerRegistration(certificate);
}
