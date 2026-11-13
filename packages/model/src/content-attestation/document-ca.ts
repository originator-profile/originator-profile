import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ContentAttestation } from "./content-attestation";
import { MediaObjectSubject } from "./media-object-subject";

const subject = z.object({
  ...MediaObjectSubject.shape,
  type: z.literal("Document"),
});

export const DocumentCA = ContentAttestation.extend({
  "@context": OpCipContext,
  credentialSubject: subject,
});

export type DocumentCA = z.infer<typeof DocumentCA>;
