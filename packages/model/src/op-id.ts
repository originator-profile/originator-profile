import { z } from "zod";

const DNS_URI_PATTERN =
  /^dns:([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export const OpId = z.string().regex(DNS_URI_PATTERN, {
  error: "Invalid OP ID: must be dns:<valid-domain>",
});

export type OpId = z.infer<typeof OpId>;
