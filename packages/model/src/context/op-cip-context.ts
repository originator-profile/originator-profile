import { z } from "zod";

export const OpCipContext = z.tuple([
  z.literal("https://www.w3.org/ns/credentials/v2"),
  z.literal("https://originator-profile.org/ns/credentials/v1"),
  z.literal("https://originator-profile.org/ns/cip/v1"),
  z.object({
    "@language": z.string().describe("Language code"),
  }),
]);

export type OpCipContext = z.infer<typeof OpCipContext>;
