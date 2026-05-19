import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { DateTimeStamp } from "../date-time-stamp";
import { OpId } from "../op-id";
import { CertificateProperties } from "./certificate-properties";

/**
 * @deprecated Use {@link ProfileAnnotation} instead.
 * The Certificate schema will be removed after 2027-01-01.
 */
export const Certificate = z.object({
  "@context": OpCipContext,
  type: z.tuple([z.literal("VerifiableCredential"), z.literal("Certificate")]),
  issuer: OpId,
  validFrom: DateTimeStamp.optional().describe(
    "Validity period start and time",
  ),
  validUntil: DateTimeStamp.optional().describe("Validity period end and time"),
  credentialSubject: CertificateProperties,
});

export type Certificate = z.infer<typeof Certificate>;
