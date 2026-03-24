import { z } from "zod";

export const Page = z.object({
  id: z.url(),
  name: z.string(),
});

export type Page = z.infer<typeof Page>;
