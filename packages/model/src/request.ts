import { z } from "zod";
import { ReviewComment } from "./review-comment";

export const Request = z.object({
  group: z.string().describe("Organization name"),
  status: z
    .enum(["pending", "approved", "rejected", "cancelled"])
    .describe("Approval flow status"),
  requestSummary: z.string().optional().describe("Request summary"),
  reviewSummary: z.string().optional().describe("Review summary"),
  reviewComments: z.array(ReviewComment).describe("Review comments"),
  createdAt: z.string().datetime().describe("Created at"),
  updatedAt: z.string().datetime().describe("Updated at"),
});

export type Request = z.infer<typeof Request>;
