import { selectByLocale } from "@originator-profile/core";
import type { WebMediaProfile } from "@originator-profile/model";
import {
  getAnnotationPolicy,
  type Certificate,
  type OriginatorPayload,
} from "@originator-profile/verify";

/** 発信者の組織 */
export type Organization = {
  /** OP ID */
  id: string;
  /** ユーザーロケールで選んだ Web Media Profile */
  media?: WebMediaProfile;
  /**
   * ユーザーロケールで選んだ Profile Annotation
   *
   * OP に含まれる順序を保つ。
   */
  annotations: Certificate[];
  /** 組織実在証が表明する国 */
  country?: string;
};

const nonNull = <T>(value: T | null): value is T => value !== null;

/** 同じ PA の別言語版を 1 つのグループにまとめるキー */
const annotationGroup = (annotation: Certificate) =>
  JSON.stringify([
    annotation.issuer,
    annotation.credentialSubject.id,
    getAnnotationPolicy(annotation).id,
  ]);

/** 組織実在証が表明する国を得る */
export function countryOf(annotations: Certificate[]): string | undefined {
  for (const annotation of annotations) {
    const subject = annotation.credentialSubject;
    if (
      subject.type === "JP-OrganizationExistenceCertificate" &&
      "addressCountry" in subject &&
      typeof subject.addressCountry === "string"
    ) {
      return subject.addressCountry;
    }
  }
  return undefined;
}

/**
 * 発信者の組織を得る
 *
 * 同じ組織の発信者はレジストリ・Site Profile・文書のそれぞれから得られうる。
 * Web Media Profile や Profile Annotation を持つのがその一部だけのこともあるため、
 * 一致する発信者をすべて合わせてから選ぶ。
 * @param id 組織の OP ID
 * @param originators 検証済みの発信者
 * @returns 一致する発信者がいなければ undefined
 */
export function organizationOf(
  id: string,
  originators: OriginatorPayload[],
): Organization | undefined {
  const matched = originators.filter(
    (op) => op.core?.credentialSubject.id === id,
  );
  if (matched.length === 0) return undefined;

  const media = matched.flatMap((op) => op.media?.filter(nonNull) ?? []);
  const annotations = selectByLocale(
    matched.flatMap((op) => op.annotations?.filter(nonNull) ?? []),
    { group: annotationGroup },
  );
  return {
    id,
    media: selectByLocale(media),
    annotations,
    country: countryOf(annotations),
  };
}
