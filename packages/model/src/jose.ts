import { z } from "zod";
import { OpId } from "./op-id";

export const Header = z.looseObject({
  alg: z.literal("ES256"),
  typ: z
    .literal("vc-ld+jwt")
    .describe(
      "[RFC 7519 Section 5.1](https://www.rfc-editor.org/rfc/rfc7519#section-5.1)",
    ),
  kid: z
    .string()
    .describe(
      "[RFC 7515 Section 4.1.4](https://www.rfc-editor.org/rfc/rfc7515.html#section-4.1.4). Must be a [JWK Thumbprint](https://www.rfc-editor.org/rfc/rfc7638.html).",
    ),
  cty: z
    .literal("WMP")
    .describe(
      "[RFC 7519 Section 5.2](https://www.rfc-editor.org/rfc/rfc7519#section-5.2)",
    ),
});

export const Claimset = z.looseObject({
  iss: OpId.describe(
    "[RFC 7519 Section 4.1.1](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.1). Must be the OP ID of the CP-issuing organization of the WMP holding organization.",
  ),
  sub: OpId.describe(
    "[RFC 7519 Section 4.1.2](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.2). Must be the OP ID of the WMP holding organization.",
  ),
  iat: z
    .number()
    .describe(
      "[RFC 7519 Section 4.1.6](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.6)",
    ),
  exp: z
    .number()
    .describe(
      "[RFC 7519 Section 4.1.4](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4)",
    ),
});

export type Header = z.infer<typeof Header>;
export type Claimset = z.infer<typeof Claimset>;
