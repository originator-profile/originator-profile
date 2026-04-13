import { z } from "zod";
import { AllowedOrigin } from "../allowed-origin";
import { AllowedUrl } from "../allowed-url";
import { OpContextHead } from "../context/op-context-head";
import { OpId } from "../op-id";
import { Target } from "../target";

export const subject = z.looseObject({
  id: z.url().describe("CA ID"),
  type: z.string().describe("JSON-LD type"),
});

export const ContentAttestation = z.looseObject({
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
  target: z.array(Target).min(1),
});

export type ContentAttestation = z.infer<typeof ContentAttestation>;
