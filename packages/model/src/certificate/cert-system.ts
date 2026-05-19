import { z } from "zod";

/**
 * @deprecated Use {@link ProfileAnnotationPolicy} instead.
 * The CertificationSystem will be removed after 2027-01-01.
 */
export const CertificationSystem = z.object({
  id: z.url().describe("Certification system ID"),
  type: z.literal("CertificationSystem"),
  name: z.string().describe("Name of the certification system"),
  description: z.string().optional().describe("Description"),
  ref: z
    .url()
    .optional()
    .describe(
      "A URL for people to read to find out more about the certification system.",
    ),
});

export type CertificationSystem = z.infer<typeof CertificationSystem>;
