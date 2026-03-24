import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { OpId } from "../op-id";
import { CertificateProperties } from "./certificate-properties";

export const Certificate = z.object({
  "@context": OpCipContext,
  type: z.tuple([z.literal("VerifiableCredential"), z.literal("Certificate")]),
  issuer: OpId,
  validFrom: z
    .string()
    .datetime()
    .optional()
    .describe("Validity period start date"),
  validUntil: z
    .string()
    .datetime()
    .optional()
    .describe("Validity period end date"),
  credentialSubject: CertificateProperties,
});

export type Certificate = z.infer<typeof Certificate>;
