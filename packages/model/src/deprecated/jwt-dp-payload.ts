import { FromSchema } from "json-schema-to-ts";
import DpAllowedOrigins from "./dp-allowed-origins";
import DpItem from "./dp-item";

/** @deprecated */
const JwtDpPayload = {
  title: "DP JWT Claims Set object",
  type: "object",
  properties: {
    iss: {
      title: "JWT Issuer",
      description:
        "[RFC 7519 Section 4.1.1](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.1)",
      type: "string",
    },
    sub: {
      title: "JWT Subject",
      description:
        "[RFC 7519 Section 4.1.2](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.2)",
      type: "string",
    },
    exp: {
      title: "JWT Expiration Time",
      description:
        "[RFC 7519 Section 4.1.4](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4)",
      type: "number",
    },
    iat: {
      title: "JWT Issued At",
      description:
        "[RFC 7519 Section 4.1.6](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.6)",
      type: "number",
    },
    "https://originator-profile.org/dp": {
      type: "object",
      properties: {
        item: { type: "array", items: DpItem },
        allowedOrigins: DpAllowedOrigins,
      },
      required: ["item"],
      additionalProperties: false,
    },
  },
  required: ["iss", "sub", "exp", "iat", "https://originator-profile.org/dp"],
  additionalProperties: false,
} as const;

/** @deprecated */
type JwtDpPayload = FromSchema<typeof JwtDpPayload>;

export default JwtDpPayload;
