import { z } from "zod";

export const OpMeta = z
  .object({
    targetopid: z.string(),
  })
  .passthrough();

export type OpMeta = z.infer<typeof OpMeta>;
