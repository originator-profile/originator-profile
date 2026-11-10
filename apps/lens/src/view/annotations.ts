import {
  getAnnotationPolicy,
  isIssuerAccreditation,
  type Certificate,
  type OriginatorPayload,
} from "@originator-profile/verify";
import { organizationOf, type Organization } from "./organization";

/** 第三者による確認 (Profile Annotation) */
export type AnnotationView = {
  /**
   * Profile Annotation Policy ID。同じ発行者の確認のあいだで一意
   * (PA は発行者・対象・ポリシーの組で 1 つに選ばれている)
   */
  id: string;
  /** PA の型 (JP-OrganizationExistenceCertificate、Membership など) */
  type: string;
  name: string;
  description?: string;
  /** 画像の URL */
  image?: string;
  /** 発行ポリシーの URL */
  policyUrl?: string;
};

/** 確認した組織 (PA 発行者) */
export type AnnotationIssuer = {
  id: string;
  name?: string;
  /** ロゴの URL */
  logo?: string;
};

/** PA 発行者ごとの第三者による確認 */
export type AnnotationGroup = {
  issuer: AnnotationIssuer;
  annotations: AnnotationView[];
};

/** 組織の詳細 */
export type OrganizationDetail = {
  organization: Organization;
  groups: AnnotationGroup[];
};

function toView(annotation: Certificate): AnnotationView {
  const policy = getAnnotationPolicy(annotation);
  const subject = annotation.credentialSubject;
  return {
    id: policy.id,
    type: subject.type,
    name:
      ("name" in subject && typeof subject.name === "string"
        ? subject.name
        : undefined) ?? policy.name,
    description:
      "description" in subject && typeof subject.description === "string"
        ? subject.description
        : undefined,
    image: subject.image?.id,
    policyUrl: "ref" in policy ? policy.ref : undefined,
  };
}

function issuerOf(
  id: string,
  originators: OriginatorPayload[],
): AnnotationIssuer {
  const subject = organizationOf(id, originators)?.media?.credentialSubject;
  return { id, name: subject?.name, logo: subject?.logo?.id };
}

/**
 * 組織の詳細を得る
 *
 * PA は発行者ごとにまとめ、OP に含まれる順序を保つ。認定証 PA は PA 発行者の
 * 資格を示すもので、組織そのものの確認ではないため含めない。
 * @param organization 組織
 * @param originators 検証済みの発信者。PA 発行者の組織を引くのに用いる
 */
export function detailOf(
  organization: Organization,
  originators: OriginatorPayload[],
): OrganizationDetail {
  const displayable = organization.annotations.filter(
    (annotation) => !isIssuerAccreditation(annotation),
  );
  const groups = Map.groupBy(displayable, ({ issuer }) => issuer)
    .entries()
    .map(([issuer, annotations]) => ({
      issuer: issuerOf(issuer, originators),
      annotations: annotations.map(toView),
    }))
    .toArray();
  return { organization, groups };
}
