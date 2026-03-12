import { z } from "zod";

/** @deprecated */
const DpUrl = z.string().describe("対象の要素が存在するページの URL");

/** @deprecated */
type DpUrl = z.infer<typeof DpUrl>;

export default DpUrl;
