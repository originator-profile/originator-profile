import { z } from "zod";
import { AllowedOrigin } from "../allowed-origin";
import { AllowedUrl } from "../allowed-url";
import { OpContextHead } from "../context/op-context-head";
import { OpId } from "../op-id";
import { RawTarget } from "../target/raw-target";
import { subject } from "./content-attestation";

export const UnsignedContentAttestation = z.looseObject({
  "@context": OpContextHead,
  type: z
    .array(z.unknown())
    .refine((arr) => arr.includes("ContentAttestation"), {
      error: `type must include "ContentAttestation"`,
    }),
  issuer: OpId,
  credentialSubject: subject,
  allowedUrl: AllowedUrl.optional(),
  allowedOrigin: AllowedOrigin.optional(),
  target: z.array(RawTarget).min(1),
});

export type UnsignedContentAttestation = z.infer<
  typeof UnsignedContentAttestation
>;
