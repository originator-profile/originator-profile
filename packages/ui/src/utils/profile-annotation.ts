import {
  CertificationSystem,
  ProfileAnnotationPolicy,
} from "@originator-profile/model";
import { Certificate } from "@originator-profile/verify";

type CredentialSubject = Certificate["credentialSubject"];

/**
 * 新形式 PA の `credentialSubject.annotation` と旧 Certificate 形式の
 * `credentialSubject.certificationSystem` は同一形状なので、存在するほうを返す。
 */
export function getAnnotationPolicy(
  credentialSubject: CredentialSubject,
): ProfileAnnotationPolicy | CertificationSystem {
  return "annotation" in credentialSubject
    ? credentialSubject.annotation
    : credentialSubject.certificationSystem;
}

/**
 * Profile Annotation Issuer 登録証 PA は inspector に表示しない。
 * 後方互換性のために非表示のままとしている。
 */
export function isDisplayableProfileAnnotation(
  certificate: Certificate,
): boolean {
  return (
    certificate.credentialSubject.type !== "ProfileAnnotationIssuerRegistration"
  );
}
