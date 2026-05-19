import { z } from "zod";
import { Image } from "../image";
import { OpId } from "../op-id";
import { CertificationSystem } from "./cert-system";

/**
 * @deprecated Use {@link ProfileAnnotationProperties} instead.
 * The CertificateProperties schema will be removed after 2027-01-01.
 */
export const CertificateProperties = z.object({
  id: OpId.describe("OP ID of the subject"),
  type: z.literal("CertificateProperties"),
  description: z.string().optional().describe("Description"),
  image: Image.optional(),
  certifier: z
    .string()
    .optional()
    .describe("Name of the certification authority"),
  verifier: z
    .string()
    .optional()
    .describe("Name of the verification authority"),
  certificationSystem: CertificationSystem,
});

export type CertificateProperties = z.infer<typeof CertificateProperties>;
