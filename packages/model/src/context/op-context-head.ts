import { z } from "zod";

export const OpContextHead = z
  .array(z.unknown())
  .refine(
    (arr) =>
      arr.includes("https://www.w3.org/ns/credentials/v2") &&
      arr.includes("https://originator-profile.org/ns/credentials/v1"),
    {
      error:
        "Context must include both W3C credentials v2 and OP credentials v1",
    },
  );

export type OpContextHead = z.infer<typeof OpContextHead>;
