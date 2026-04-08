import { z } from "zod";
import { OpContextHead } from "./context/op-context-head";
import { OpId } from "./op-id";

export const OpVc = z.looseObject({
  "@context": OpContextHead,
  type: z
    .array(z.unknown())
    .refine((arr) => arr.includes("VerifiableCredential"), {
      error: `type must include "VerifiableCredential"`,
    }),
  issuer: OpId,
  credentialSubject: z.looseObject({
    id: OpId,
  }),
});

export type OpVc = z.infer<typeof OpVc>;
