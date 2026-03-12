import { z } from "zod";
import { Jwks } from "../jwks";
import OpItem from "./op-item";

/** @deprecated */
const JwtOpPayload = z.object({
  iss: z
    .string()
    .describe(
      "[RFC 7519 Section 4.1.1](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.1)",
    ),
  sub: z
    .string()
    .describe(
      "[RFC 7519 Section 4.1.2](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.2)",
    ),
  exp: z
    .number()
    .describe(
      "[RFC 7519 Section 4.1.4](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4)",
    ),
  iat: z
    .number()
    .describe(
      "[RFC 7519 Section 4.1.6](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.6)",
    ),
  "https://originator-profile.org/op": z.object({
    item: z.array(OpItem),
    jwks: Jwks.optional(),
  }),
});

/** @deprecated */
type JwtOpPayload = z.infer<typeof JwtOpPayload>;

export default JwtOpPayload;
