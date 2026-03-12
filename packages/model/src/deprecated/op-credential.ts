import { z } from "zod";

/** @deprecated */
const OpCredential = z
  .object({
    type: z.literal("credential"),
    certifier: z
      .string()
      .describe("Unique identifier representing the certification body"),
    verifier: z
      .string()
      .describe("Unique identifier representing the verification agency"),
    name: z.string().describe("Credential name"),
    url: z
      .string()
      .optional()
      .describe("URL where a JSON of type CertificationSystem is served."),
    image: z.string().optional().describe("Image URL"),
    issuedAt: z.string().datetime().describe("Issued at"),
    expiredAt: z.string().datetime().describe("Expired at"),
  })
  .describe("Credentials such as a certification body's report");

/** @deprecated */
type OpCredential = z.infer<typeof OpCredential>;

export default OpCredential;
