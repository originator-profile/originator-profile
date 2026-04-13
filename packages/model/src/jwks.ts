import { z } from "zod";
import { Jwk } from "./jwk";

export const Jwks = z.looseObject({
  keys: z.array(Jwk),
});

export type Jwks = z.infer<typeof Jwks>;
