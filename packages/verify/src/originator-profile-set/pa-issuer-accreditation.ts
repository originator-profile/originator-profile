import {
  CertificationSystem,
  IssuerAccreditation,
  ProfileAnnotationIssuerRegistration,
  ProfileAnnotationPolicy,
} from "@originator-profile/model";
import { VerifiedJwtVc } from "@originator-profile/securing-mechanism";
import type { Logger } from "../logger";
import { pointer } from "../result/pointer";
import { ProblemType } from "../result/problem-types";
import type { Certificate, VerifiedOps } from "./types";

/** 認可された Profile Annotation Policy ID の集合 */
type ProfileAnnotationPolicyMap = Map<
  /** 対象の OP ID */
  string,
  /** 認可された Profile Annotation Policy ID の集合 */
  Set<string>
>;

/** 新形式 PA の `credentialSubject.annotation` と旧 Certificate 形式の `credentialSubject.certificationSystem` 存在するほうを返す */
export function getAnnotationPolicy(
  doc: Certificate,
): ProfileAnnotationPolicy | CertificationSystem {
  return "annotation" in doc.credentialSubject
    ? doc.credentialSubject.annotation
    : doc.credentialSubject.certificationSystem;
}

/**
 * Profile Annotation かどうか
 *
 * 非推奨の `Certificate`（`type` が `["VerifiableCredential", "Certificate"]`）は除外
 */
const isProfileAnnotation = (doc: Certificate): boolean =>
  (doc.type as readonly string[]).includes("ProfileAnnotation");

/**
 * Issuer Accreditation (Profile Annotation Issuer 認定証 PA) かどうか
 *
 * 後方互換性のため、旧 type `ProfileAnnotationIssuerRegistration` (旧名称「登録証」) も認定証 PA として扱う
 */
export function isIssuerAccreditation(
  doc: Certificate,
): doc is IssuerAccreditation | ProfileAnnotationIssuerRegistration {
  return (
    doc.credentialSubject.type === "IssuerAccreditation" ||
    isProfileAnnotationIssuerRegistration(doc)
  );
}

/**
 * 旧 type `ProfileAnnotationIssuerRegistration` の PA かどうか
 *
 * @deprecated 新 type を含めて判定する `isIssuerAccreditation` を使用すること
 */
export function isProfileAnnotationIssuerRegistration(
  doc: Certificate,
): doc is ProfileAnnotationIssuerRegistration {
  return doc.credentialSubject.type === "ProfileAnnotationIssuerRegistration";
}

/**
 * 認可される対象の OP ID ごとの Profile Annotation Policy を集約
 * (PA Issuer Accreditation Issuer が発行した認定証 PA のみを採用)
 */
function buildProfileAnnotationPolicy(
  /** 検証済みの OP の集合 */
  verifiedOps: VerifiedOps,
  /** PA Issuer Accreditation Issuer の OP ID の集合 */
  paIssuerAccreditationIssuers: ReadonlySet<string>,
): ProfileAnnotationPolicyMap {
  const policy: ProfileAnnotationPolicyMap = new Map();
  const annotations = verifiedOps.flatMap((op) => op.annotations ?? []);
  for (const { doc } of annotations) {
    if (!isIssuerAccreditation(doc)) continue;
    if (!paIssuerAccreditationIssuers.has(doc.issuer)) continue;
    const { id: accreditedIssuer, annotationScheme } = doc.credentialSubject;
    // annotationScheme を持たない Issuer Accreditation は Profile Annotation Issuer としての認定ではないため対象外
    if (!Array.isArray(annotationScheme)) continue;
    const allowedPolicy = policy.get(accreditedIssuer) ?? new Set<string>();
    for (const scheme of annotationScheme) allowedPolicy.add(scheme);
    policy.set(accreditedIssuer, allowedPolicy);
  }
  return policy;
}

/** 認可外の Profile Annotation を検出した際の通知 */
function reportUnauthorizedAnnotation({
  annotation,
  opIndex,
  paIndex,
  policy,
  logger,
}: {
  /** 対象の PA */
  annotation: VerifiedJwtVc<Certificate>;
  /** OP のインデックス */
  opIndex: number;
  /** PA のインデックス */
  paIndex: number;
  /** 認可された Profile Annotation Policy の集合 */
  policy: ProfileAnnotationPolicyMap;
  /** ロガー */
  logger: Logger;
}): void {
  const { doc } = annotation;
  const { issuer: profileAnnotationIssuer } = doc;
  const location = `OP[${opIndex}].PA[${paIndex}]`;
  const at = pointer("originators", opIndex, "annotations", paIndex);

  if (!isProfileAnnotation(doc)) {
    const message = `Certificate is deprecated (${location})`;
    logger.warn(message, {
      type: ProblemType.CertificateDeprecated,
      title: message,
      pointer: at,
    });
    return;
  }

  const policyId = getAnnotationPolicy(doc)?.id;
  const isAllowed =
    policyId && policy.get(profileAnnotationIssuer)?.has(policyId);
  if (!isAllowed) {
    const scheme = policyId ?? "unknown";
    const message = `Profile Annotation Issuer is not registered for this annotation scheme (${location} issuer: ${profileAnnotationIssuer}, scheme: ${scheme})`;
    logger.info(message, {
      type: ProblemType.PaIssuerNotRegistered,
      title: message,
      detail: `issuer: ${profileAnnotationIssuer}, scheme: ${scheme}`,
      pointer: at,
    });
  }
}

/**
 * Profile Annotation Issuer 認定証 PA に基づく発行者の認可を確認
 *
 * 各 Profile Annotation の発行者が、基底となる Profile Annotation Issuer 認定証 PA によって、その PA が準拠する 認証制度（Profile Annotation Policy）の発行を認可されているかを検証
 *
 * @param verifiedOps 検証済み Originator Profile Set
 * @param paIssuerAccreditationIssuer 基底となる Profile Annotation Issuer 認定証 PA Issuer の OP ID
 * @param logger ロガー (デフォルト: `console`)
 *
 * @see https://docs.originator-profile.org/opb/pa-model/profile-annotation-issuer-accreditation/
 */
export function verifyAnnotationIssuerAccreditation(
  verifiedOps: VerifiedOps,
  paIssuerAccreditationIssuer: string | string[],
  logger: Logger = console,
): VerifiedOps {
  const paIssuerAccreditationIssuers = new Set(
    [paIssuerAccreditationIssuer].flat(),
  );
  const policy = buildProfileAnnotationPolicy(
    verifiedOps,
    paIssuerAccreditationIssuers,
  );
  for (const [opIndex, op] of verifiedOps.entries()) {
    for (const [paIndex, annotation] of op.annotations?.entries() ?? []) {
      reportUnauthorizedAnnotation({
        annotation,
        opIndex,
        paIndex,
        policy,
        logger,
      });
    }
  }
  return verifiedOps;
}

/**
 * @deprecated 後方互換性のために残している。
 * `verifyAnnotationIssuerAccreditation` を使用すること。
 */
export const verifyAnnotationIssuerRegistration =
  verifyAnnotationIssuerAccreditation;
