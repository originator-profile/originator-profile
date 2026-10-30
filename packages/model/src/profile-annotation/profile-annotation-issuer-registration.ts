import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ProfileAnnotation } from "./profile-annotation";
import { ProfileAnnotationIssuerAccreditationProperties } from "./profile-annotation-issuer-accreditation";

/**
 * @deprecated 旧名称「Profile Annotation Issuer 登録証」の type。
 * 後方互換性のために残している。
 * `ProfileAnnotationIssuerAccreditationProperties` を使用すること。
 */
export const ProfileAnnotationIssuerRegistrationProperties =
  ProfileAnnotationIssuerAccreditationProperties.extend({
    type: z.literal("ProfileAnnotationIssuerRegistration"),
  });

/**
 * @deprecated 後方互換性のために残している。
 * `ProfileAnnotationIssuerAccreditation` を使用すること。
 */
export const ProfileAnnotationIssuerRegistration = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: ProfileAnnotationIssuerRegistrationProperties,
});

/**
 * @deprecated 後方互換性のために残している。
 * `ProfileAnnotationIssuerAccreditation` を使用すること。
 */
export type ProfileAnnotationIssuerRegistration = z.infer<
  typeof ProfileAnnotationIssuerRegistration
>;
