import { z } from "zod";

export const CpContext = z.tuple([
  z.literal("https://www.w3.org/ns/credentials/v2"),
  z.literal("https://originator-profile.org/ns/credentials/v1"),
]);

export type CpContext = z.infer<typeof CpContext>;
