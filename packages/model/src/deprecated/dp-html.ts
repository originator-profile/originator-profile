import { z } from "zod";
import DpLocation from "./dp-location";
import DpProof from "./dp-proof";
import DpUrl from "./dp-url";

/** @deprecated */
const DpHtml = z
  .object({
    type: z.literal("html"),
    url: DpUrl.optional(),
    location: DpLocation.optional(),
    proof: DpProof,
  })
  .describe(
    "HTML of the target element and its descendants, and its signature",
  );

/** @deprecated */
type DpHtml = z.infer<typeof DpHtml>;

export default DpHtml;
