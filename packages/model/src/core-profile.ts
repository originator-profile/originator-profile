import { z } from "zod";
import { CpContext } from "./context/cp-context";
import { Jwks } from "./jwks";
import { OpId } from "./op-id";

export const CoreProfile = z.object({
  "@context": CpContext,
  type: z.tuple([z.literal("VerifiableCredential"), z.literal("CoreProfile")]),
  issuer: OpId,
  credentialSubject: z.object({
    id: OpId,
    type: z.literal("Core"),
    jwks: Jwks,
  }),
});

export type CoreProfile = z.infer<typeof CoreProfile>;
