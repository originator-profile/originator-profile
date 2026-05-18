import { z } from "zod";
import { Image } from "../image";
import { OpId } from "../op-id";
import { ProfileAnnotationPolicy } from "./profile-annotation-policy";

export const ProfileAnnotationProperties = z.looseObject({
  id: OpId.describe("OP ID of the subject"),
  type: z.string().describe("PA-specific subtype identifier"),
  name: z.string().optional().describe("PA name"),
  description: z.string().optional().describe("Description"),
  image: Image.optional(),
  annotationScheme: z
    .array(z.url())
    .optional()
    .describe("URIs identifying related PA sets"),
  annotation: ProfileAnnotationPolicy,
});

export type ProfileAnnotationProperties = z.infer<
  typeof ProfileAnnotationProperties
>;
