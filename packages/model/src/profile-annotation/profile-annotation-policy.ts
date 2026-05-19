import { z } from "zod";

export const ProfileAnnotationPolicy = z.object({
  id: z.url().describe("Profile Annotation Policy ID"),
  type: z.literal("ProfileAnnotationPolicy"),
  name: z.string().describe("Name of the Profile Annotation Policy"),
  description: z.string().optional().describe("Description"),
  ref: z
    .url()
    .optional()
    .describe(
      "A URL for people to read to find out more about the Profile Annotation Policy.",
    ),
});

export type ProfileAnnotationPolicy = z.infer<typeof ProfileAnnotationPolicy>;
