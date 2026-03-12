import { z } from "zod";

/** @deprecated */
const DpProof = z
  .object({
    jws: z.string().describe("Detached JSON Web Signature"),
  })
  .describe("Signature for the target text");

/** @deprecated */
type DpProof = z.infer<typeof DpProof>;

export default DpProof;
