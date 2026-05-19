import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { DateTimeStamp } from "../date-time-stamp";
import { Image } from "../image";
import { OpId } from "../op-id";
import { CertificationSystem } from "./cert-system";

/**
 * @deprecated Use {@link JapaneseExistencePAProperties} instead.
 * The legacy Certificate-based schema will be removed after 2027-01-01.
 */
export const JapaneseExistenceCertificateProperties = z.object({
  id: OpId.describe("OP ID of the subject"),
  type: z.literal("JP-OrganizationExistenceCertificate"),
  name: z.string().describe("PA name"),
  description: z.string().optional().describe("Description"),
  image: Image.optional(),
  corporateName: z.string().describe("Corporate name"),
  corporateNumber: z.string().describe("Corporate number"),
  postalCode: z.string().describe("Postal code"),
  addressCountry: z.string().describe("Country"),
  addressRegion: z.string().describe("Prefecture / State"),
  addressLocality: z.string().describe("City / Municipality"),
  streetAddress: z.string().describe("Street address"),
  certificationSystem: CertificationSystem,
});

/**
 * @deprecated Use {@link JapaneseExistencePA} instead.
 * The legacy Certificate-based schema will be removed after 2027-01-01.
 */
export const JapaneseExistenceCertificate = z.looseObject({
  "@context": OpCipContext,
  type: z.tuple([z.literal("VerifiableCredential"), z.literal("Certificate")]),
  issuer: OpId,
  credentialSubject: JapaneseExistenceCertificateProperties,
  validFrom: DateTimeStamp.optional().describe(
    "Validity period start and time",
  ),
  validUntil: DateTimeStamp.optional().describe("Validity period end and time"),
});

export type JapaneseExistenceCertificate = z.infer<
  typeof JapaneseExistenceCertificate
>;
