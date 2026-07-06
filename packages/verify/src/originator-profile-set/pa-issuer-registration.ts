import {
  CertificationSystem,
  ProfileAnnotationIssuerRegistration,
  ProfileAnnotationPolicy,
} from "@originator-profile/model";
import { VerifiedJwtVc } from "@originator-profile/securing-mechanism";
import type { WarnHandler } from "../warn";
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

/** Profile Annotation Issuer 登録証 PA かどうか */
export function isProfileAnnotationIssuerRegistration(
  doc: Certificate,
): doc is ProfileAnnotationIssuerRegistration {
  return doc.credentialSubject.type === "ProfileAnnotationIssuerRegistration";
}

/**
 * 認可される対象の OP ID ごとの Profile Annotation Policy を集約
 * (Core Profile Issuer が発行した登録証 PA のみを採用)
 */
function buildProfileAnnotationPolicy(
  /** 検証済みの OP の集合 */
  verifiedOps: VerifiedOps,
  /** Core Profile Issuer の OP ID の集合 */
  cpIssuers: ReadonlySet<string>,
): ProfileAnnotationPolicyMap {
  const policy: ProfileAnnotationPolicyMap = new Map();
  const annotations = verifiedOps.flatMap((op) => op.annotations ?? []);
  for (const { doc } of annotations) {
    if (!isProfileAnnotationIssuerRegistration(doc)) continue;
    if (!cpIssuers.has(doc.issuer)) continue;
    const { id: registrationIssuer, annotationScheme } = doc.credentialSubject;
    const allowedPolicy = policy.get(registrationIssuer) ?? new Set<string>();
    for (const scheme of annotationScheme) allowedPolicy.add(scheme);
    policy.set(registrationIssuer, allowedPolicy);
  }
  return policy;
}

/** 認可外の Profile Annotation を検出した際に警告 */
function reportUnauthorizedAnnotation({
  annotation,
  opIndex,
  paIndex,
  policy,
  cpIssuers,
  warn,
}: {
  /** 対象の PA */
  annotation: VerifiedJwtVc<Certificate>;
  /** OP のインデックス */
  opIndex: number;
  /** PA のインデックス */
  paIndex: number;
  /** 認可された Profile Annotation Policy の集合 */
  policy: ProfileAnnotationPolicyMap;
  /** Core Profile Issuer の OP ID の集合 */
  cpIssuers: ReadonlySet<string>;
  /** 警告ハンドラー */
  warn: WarnHandler;
}): void {
  const { doc } = annotation;
  const { issuer: profileAnnotationIssuer } = doc;
  const location = `OP[${opIndex}].PA[${paIndex}]`;

  if (!isProfileAnnotation(doc)) {
    warn(`Certificate is deprecated (${location})`);
    return;
  }

  if (
    isProfileAnnotationIssuerRegistration(doc) &&
    cpIssuers.has(profileAnnotationIssuer)
  ) {
    return;
  }

  const policyId = getAnnotationPolicy(doc)?.id;
  const isAllowed =
    policyId && policy.get(profileAnnotationIssuer)?.has(policyId);
  if (!isAllowed) {
    warn(
      `Profile Annotation Issuer is not registered for this annotation scheme (${location} issuer: ${profileAnnotationIssuer}, scheme: ${policyId ?? "unknown"})`,
    );
  }
}

/**
 * Profile Annotation Issuer 登録証 PA に基づく発行者の認可を確認
 *
 * 各 Profile Annotation の発行者が、Core Profile Issuer から発行された登録証 PA によって、その PA が準拠する 認証制度（Profile Annotation Policy）の発行を認可されているかを検証
 *
 * (2027年まで) 後方互換性のため、認可を確認できない場合も検証は失敗させず warn に留める。
 *
 * @param verifiedOps 検証済み Originator Profile Set
 * @param cpIssuer 基底となる Core Profile Issuer の OP ID
 * @param warn 警告ハンドラー (デフォルト: `console.warn`)
 *
 * @see https://docs.originator-profile.org/opb/pa-model/profile-annotation-issuer-registration/
 */
export function verifyAnnotationIssuerRegistration(
  verifiedOps: VerifiedOps,
  cpIssuer: string | string[],
  warn: WarnHandler = console.warn,
): VerifiedOps {
  const cpIssuers = new Set([cpIssuer].flat());
  const policy = buildProfileAnnotationPolicy(verifiedOps, cpIssuers);
  for (const [opIndex, op] of verifiedOps.entries()) {
    for (const [paIndex, annotation] of op.annotations?.entries() ?? []) {
      reportUnauthorizedAnnotation({
        annotation,
        opIndex,
        paIndex,
        policy,
        cpIssuers,
        warn,
      });
    }
  }
  return verifiedOps;
}
