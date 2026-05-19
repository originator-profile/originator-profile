import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ProfileAnnotation } from "./profile-annotation";
import { ProfileAnnotationProperties } from "./profile-annotation-properties";

export const JapaneseExistencePAProperties = ProfileAnnotationProperties.extend(
  {
    type: z.literal("JP-OrganizationExistenceCertificate"),
    corporateName: z.string().describe("Corporate name"),
    corporateNumber: z.string().describe("Corporate number"),
    postalCode: z.string().describe("Postal code"),
    addressCountry: z.string().describe("Country"),
    addressRegion: z.string().describe("Prefecture / State"),
    addressLocality: z.string().describe("City / Municipality"),
    streetAddress: z.string().describe("Street address"),
  },
);

export const JapaneseExistencePA = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: JapaneseExistencePAProperties,
});

export type JapaneseExistencePA = z.infer<typeof JapaneseExistencePA>;
