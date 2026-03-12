import { z } from "zod";
import { Jwks } from "../jwks";
import OpItem from "./op-item";

/** @deprecated */
const Op = z.object({
  type: z.literal("op"),
  issuer: z
    .string()
    .describe("Unique identifier representing the organization"),
  subject: z
    .string()
    .describe(
      "Unique identifier representing the identity of an organization involved in media, advertising, etc., or its primary publication",
    ),
  issuedAt: z.string().datetime().describe("Issued at"),
  expiredAt: z.string().datetime().describe("Expired at"),
  item: z.array(OpItem),
  jwks: Jwks,
});

/** @deprecated */
type Op = z.infer<typeof Op>;

export default Op;
