import { z } from "zod";

export const OpContext = z.tuple([
  z.literal("https://www.w3.org/ns/credentials/v2"),
  z.literal("https://originator-profile.org/ns/credentials/v1"),
  z.object({
    "@language": z.string().describe("Language code"),
  }),
]);

export type OpContext = z.infer<typeof OpContext>;
