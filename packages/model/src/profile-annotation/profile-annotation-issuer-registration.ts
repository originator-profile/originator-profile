import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { IssuerAccreditationProperties } from "./issuer-accreditation";
import { ProfileAnnotation } from "./profile-annotation";

/**
 * @deprecated 旧名称「Profile Annotation Issuer 登録証」の type。
 * 後方互換性のために残している。
 * `IssuerAccreditationProperties` を使用すること。
 */
export const ProfileAnnotationIssuerRegistrationProperties =
  IssuerAccreditationProperties.extend({
    type: z.literal("ProfileAnnotationIssuerRegistration"),
  });

/**
 * @deprecated 後方互換性のために残している。
 * `IssuerAccreditation` を使用すること。
 */
export const ProfileAnnotationIssuerRegistration = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: ProfileAnnotationIssuerRegistrationProperties,
});

/**
 * @deprecated 後方互換性のために残している。
 * `IssuerAccreditation` を使用すること。
 */
export type ProfileAnnotationIssuerRegistration = z.infer<
  typeof ProfileAnnotationIssuerRegistration
>;
