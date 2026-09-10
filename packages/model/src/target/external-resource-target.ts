import { z } from "zod";
import { SubresourceIntegrity } from "../sri";

export const ExternalResourceTarget = z.looseObject({
  type: z.literal("ExternalResourceTargetIntegrity"),
  integrity: SubresourceIntegrity,
  cssSelector: z.string().optional().describe("CSS selector"),
});

export type ExternalResourceTarget = z.infer<typeof ExternalResourceTarget>;
