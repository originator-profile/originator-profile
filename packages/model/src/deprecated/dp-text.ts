import { z } from "zod";
import DpLocation from "./dp-location";
import DpProof from "./dp-proof";
import DpUrl from "./dp-url";

/** @deprecated */
const DpText = z
  .object({
    type: z.literal("text"),
    url: DpUrl.optional(),
    location: DpLocation.optional(),
    proof: DpProof,
  })
  .describe("Text of the target element's descendants and its signature");

/** @deprecated */
type DpText = z.infer<typeof DpText>;

export default DpText;
