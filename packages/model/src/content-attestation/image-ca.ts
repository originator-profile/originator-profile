import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ContentAttestation } from "./content-attestation";
import { MediaObjectSubject } from "./media-object-subject";

const subject = z.object({
  ...MediaObjectSubject.shape,
  type: z.literal("Image"),
});

export const ImageCA = ContentAttestation.extend({
  "@context": OpCipContext,
  credentialSubject: subject,
});

export type ImageCA = z.infer<typeof ImageCA>;
