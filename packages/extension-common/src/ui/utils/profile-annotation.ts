import { Certificate, isIssuerAccreditation } from "@originator-profile/verify";

/**
 * Profile Annotation Issuer 認定証 PA (旧名称: 登録証) は inspector に表示しない。
 * 後方互換性のために非表示のままとしている。
 */
export function isDisplayableProfileAnnotation(
  certificate: Certificate,
): boolean {
  return !isIssuerAccreditation(certificate);
}
