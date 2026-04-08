import { z } from "zod";

export const Jwk = z.looseObject({
  kty: z.string(),
  use: z.string().optional(),
  key_ops: z.array(z.string()).optional(),
  alg: z.string().optional(),
  kid: z.string(),
  x5u: z.string().optional(),
  x5c: z.array(z.string()).optional(),
  x5t: z.string().optional(),
  "x5t#S256": z.string().optional(),
});

export type Jwk = z.infer<typeof Jwk>;
