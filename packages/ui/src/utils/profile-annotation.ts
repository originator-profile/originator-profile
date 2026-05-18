import { Certificate } from "@originator-profile/verify";

type CredentialSubject = Certificate["credentialSubject"];

type AnnotationPolicy = {
  id: string;
  name: string;
  description?: string;
  ref?: string;
};

/**
 * 新形式 PA の `credentialSubject.annotation` と旧 Certificate 形式の
 * `credentialSubject.certificationSystem` は同一形状なので、存在するほうを返す。
 */
export function getAnnotationPolicy(
  credentialSubject: CredentialSubject,
): AnnotationPolicy {
  const subject = credentialSubject as CredentialSubject & {
    annotation?: AnnotationPolicy;
    certificationSystem?: AnnotationPolicy;
  };
  return (subject.annotation ??
    subject.certificationSystem) as AnnotationPolicy;
}
