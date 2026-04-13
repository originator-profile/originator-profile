import { z } from "zod";
import { SubresourceIntegrity } from "./sri";

export const RawImage = z.object({
  id: z.url(),
  content: z
    .union([z.string(), z.array(z.string())])
    .describe("Transient content for digestSRI auto-calculation"),
});

export type RawImage = z.infer<typeof RawImage>;

export const Image = z.object({
  id: z.url(),
  digestSRI: SubresourceIntegrity.optional(),
});

export type Image = z.infer<typeof Image>;
