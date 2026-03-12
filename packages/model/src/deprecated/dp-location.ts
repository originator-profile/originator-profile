import { z } from "zod";

/** @deprecated */
const DpLocation = z
  .string()
  .describe("対象の要素の場所を特定する CSS セレクター");

/** @deprecated */
type DpLocation = z.infer<typeof DpLocation>;

export default DpLocation;
