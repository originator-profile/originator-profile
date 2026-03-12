import { z } from "zod";
import DpLocation from "./dp-location";
import DpProof from "./dp-proof";
import DpUrl from "./dp-url";

/** @deprecated */
const DpVisibleText = z
  .object({
    type: z.literal("visibleText"),
    url: DpUrl.optional(),
    location: DpLocation.optional(),
    proof: DpProof,
  })
  .describe(
    "Rendered text of the target element's descendants and its signature",
  );

/** @deprecated */
type DpVisibleText = z.infer<typeof DpVisibleText>;

export default DpVisibleText;
