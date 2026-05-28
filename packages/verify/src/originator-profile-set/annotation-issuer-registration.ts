import { ProfileAnnotationIssuerRegistration } from "@originator-profile/model";
import { VerifiedJwtVc } from "@originator-profile/securing-mechanism";
import type { Certificate, VerifiedOps } from "./types";

/** 発行者 OP ID ごとの登録証で認可された Profile Annotation Policy IDs */
type ProfileAnnotationIssuerRegistry = Map<string, Set<string>>;

const isPaIssuerRegistration = (
  pa: Certificate,
): pa is ProfileAnnotationIssuerRegistration =>
  pa.credentialSubject.type === "ProfileAnnotationIssuerRegistration";

const isProfileAnnotation = (pa: Certificate): boolean =>
  // @ts-expect-error "Certificate" のケースが 非推奨だが "ProfileAnnotation" を持たないためエラー
  pa.type.includes("ProfileAnnotation");

/**
 * 発行者 OP ID をキーに、登録証で認可された Profile Annotation Policy ID を集約。
 * REGISTRY_OPS の issuer から発行された登録証 PA のみを採用する。
 */
function buildIssuerRegistry(
  verifiedOps: VerifiedOps,
  registryIssuers: ReadonlySet<string>,
): ProfileAnnotationIssuerRegistry {
  const registry: ProfileAnnotationIssuerRegistry = new Map();
  const allAnnotations = verifiedOps.flatMap((op) => op.annotations ?? []);
  for (const annotation of allAnnotations) {
    if (!isPaIssuerRegistration(annotation.doc)) continue;
    if (!registryIssuers.has(annotation.doc.issuer)) continue;
    const { id, annotationScheme } = annotation.doc.credentialSubject;
    // TODO: ES2026 Map.prototype.getOrInsert が使えるようになったら使う
    const existing = registry.get(id) ?? [];
    registry.set(id, new Set([...existing, ...annotationScheme]));
  }
  return registry;
}

function getAnnotationPolicyId(
  annotation: VerifiedJwtVc<Certificate>,
): string | undefined {
  const subject = annotation.doc.credentialSubject;
  return "annotation" in subject ? subject.annotation.id : undefined;
}

function warnIfUnregisteredAnnotation(
  annotation: VerifiedJwtVc<Certificate>,
  opIndex: number,
  paIndex: number,
  registry: ProfileAnnotationIssuerRegistry,
  registryIssuers: ReadonlySet<string>,
): void {
  const { issuer } = annotation.doc;

  if (isPaIssuerRegistration(annotation.doc)) {
    if (registryIssuers.has(issuer)) return;
    console.warn(
      `Profile Annotation Issuer Registration is not issued by REGISTRY_OPS (OP[${opIndex}].PA[${paIndex}] issuer: ${issuer})`,
    );
    return;
  }

  if (!isProfileAnnotation(annotation.doc)) {
    console.warn(
      `Certificate is deprecated (OP[${opIndex}].PA[${paIndex}] issuer: ${issuer})`,
    );
    return;
  }

  const policyId = getAnnotationPolicyId(annotation);
  const allowed = registry.get(issuer);
  if (policyId && allowed?.has(policyId)) return;

  console.warn(
    `Profile Annotation Issuer is not registered (OP[${opIndex}].PA[${paIndex}] issuer: ${issuer}, scheme: ${policyId ?? "unknown"})`,
  );
}

/**
 * Profile Annotation Issuer 登録証 PA の登録状況を確認し、
 * 登録されていない PA が含まれる場合は console.warn で警告する。
 *
 * 登録証 PA は REGISTRY_OPS の issuer によって発行されたものだけを採用する。
 *
 * @param verifiedOps 検証済み Originator Profile Set
 * @param registryIssuer 登録証 PA の発行者として認める OP ID (= REGISTRY_OPS の issuer)
 *
 * @see https://docs.originator-profile.org/opb/pa-model/profile-annotation-issuer-registration
 */
export function verifyAnnotationIssuerRegistration(
  verifiedOps: VerifiedOps,
  registryIssuer: string | string[],
): void {
  const registryIssuers = new Set(
    Array.isArray(registryIssuer) ? registryIssuer : [registryIssuer],
  );
  const registry = buildIssuerRegistry(verifiedOps, registryIssuers);
  for (const [opIndex, op] of verifiedOps.entries()) {
    const annotations = op.annotations ?? [];
    annotations.forEach((annotation, paIndex) => {
      warnIfUnregisteredAnnotation(
        annotation,
        opIndex,
        paIndex,
        registry,
        registryIssuers,
      );
    });
  }
}
