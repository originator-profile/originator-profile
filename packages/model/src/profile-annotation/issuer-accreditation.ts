import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ProfileAnnotation } from "./profile-annotation";
import { ProfileAnnotationProperties } from "./profile-annotation-properties";

export const IssuerAccreditationProperties = ProfileAnnotationProperties.extend(
  {
    type: z.literal("IssuerAccreditation"),
    annotationIssuerName: z
      .string()
      .describe("Name of the Profile Annotation Issuer"),
    annotationScheme: z
      .array(z.url())
      .describe(
        "URIs identifying Profile Annotations the issuer is authorized to issue",
      ),
  },
);

export const IssuerAccreditation = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: IssuerAccreditationProperties,
});

export type IssuerAccreditation = z.infer<typeof IssuerAccreditation>;
