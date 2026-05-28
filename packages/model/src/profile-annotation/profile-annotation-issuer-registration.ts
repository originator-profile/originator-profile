import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ProfileAnnotation } from "./profile-annotation";
import { ProfileAnnotationProperties } from "./profile-annotation-properties";

export const ProfileAnnotationIssuerRegistrationProperties =
  ProfileAnnotationProperties.extend({
    type: z.literal("ProfileAnnotationIssuerRegistration"),
    annotationIssuerName: z
      .string()
      .describe("Name of the Profile Annotation Issuer"),
    annotationScheme: z
      .array(z.url())
      .describe(
        "URIs identifying Profile Annotations the issuer is authorized to issue",
      ),
  });

export const ProfileAnnotationIssuerRegistration = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: ProfileAnnotationIssuerRegistrationProperties,
});

export type ProfileAnnotationIssuerRegistration = z.infer<
  typeof ProfileAnnotationIssuerRegistration
>;
