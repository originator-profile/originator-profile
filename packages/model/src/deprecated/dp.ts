import { z } from "zod";
import DpItem from "./dp-item";

/** @deprecated */
const Dp = z.object({
  type: z.literal("dp"),
  issuer: z
    .string()
    .describe("Unique identifier representing the organization"),
  subject: z
    .string()
    .describe("Unique identifier representing the publication"),
  issuedAt: z.string().datetime().describe("Issued at"),
  expiredAt: z.string().datetime().describe("Expired at"),
  item: z.array(DpItem),
  allowedOrigins: z.array(z.string()),
});

/** @deprecated */
type Dp = z.infer<typeof Dp>;

export default Dp;
