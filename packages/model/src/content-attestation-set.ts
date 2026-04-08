import { z } from "zod";

export const ContentAttestationSetItem = z.union([
  z.looseObject({
    main: z.literal(true).describe("Main content"),
    attestation: z.string().describe("Content Attestation"),
  }),
  z.string().describe("Content Attestation"),
]);

export const ContentAttestationSet = z.array(ContentAttestationSetItem);

export type ContentAttestationSetItem = z.infer<
  typeof ContentAttestationSetItem
>;
export type ContentAttestationSet = z.infer<typeof ContentAttestationSet>;
