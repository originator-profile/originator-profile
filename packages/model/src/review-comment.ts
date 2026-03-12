import { z } from "zod";

export const ReviewComment = z.object({
  requestFieldName: z
    .string()
    .describe("Request field name (name attribute of the HTML element)"),
  comment: z.string().describe("Comment"),
});

export type ReviewComment = z.infer<typeof ReviewComment>;
