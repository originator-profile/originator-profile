import { z } from "zod";
import DpItem from "./dp-item";

/** @deprecated */
const JwtDpPayload = z.object({
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
  "https://originator-profile.org/dp": z.object({
    item: z.array(DpItem),
    allowedOrigins: z.array(z.string()).optional(),
  }),
});

/** @deprecated */
type JwtDpPayload = z.infer<typeof JwtDpPayload>;

export default JwtDpPayload;
