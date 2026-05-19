import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { DateTimeStamp } from "../date-time-stamp";
import { Image } from "../image";
import { OpId } from "../op-id";
import { ProfileAnnotationPolicy } from "./profile-annotation-policy";

export const JapaneseExistencePAProperties = z.object({
  id: OpId.describe("OP ID of the subject"),
  type: z.literal("JP-OrganizationExistenceCertificate"),
  name: z.string().optional().describe("PA name"),
  description: z.string().optional().describe("Description"),
  image: Image.optional(),
  corporateName: z.string().describe("Corporate name"),
  corporateNumber: z.string().describe("Corporate number"),
  postalCode: z.string().describe("Postal code"),
  addressCountry: z.string().describe("Country"),
  addressRegion: z.string().describe("Prefecture / State"),
  addressLocality: z.string().describe("City / Municipality"),
  streetAddress: z.string().describe("Street address"),
  annotation: ProfileAnnotationPolicy,
});

export const JapaneseExistencePA = z.looseObject({
  "@context": OpCipContext,
  type: z.tuple([
    z.literal("VerifiableCredential"),
    z.literal("ProfileAnnotation"),
  ]),
  issuer: OpId,
  credentialSubject: JapaneseExistencePAProperties,
  validFrom: DateTimeStamp.optional().describe(
    "Validity period start and time",
  ),
  validUntil: DateTimeStamp.optional().describe("Validity period end and time"),
});

export type JapaneseExistencePA = z.infer<typeof JapaneseExistencePA>;
