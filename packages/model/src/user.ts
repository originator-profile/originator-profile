import { z } from "zod";

export const User = z.object({
  id: z.string().describe("User account identifier"),
  email: z.string().optional().describe("Email address"),
  name: z.string().describe("Name"),
  picture: z.string().describe("Picture"),
});

export type User = z.infer<typeof User>;
