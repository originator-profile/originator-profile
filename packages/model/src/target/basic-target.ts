import { z } from "zod";
import { SubresourceIntegrity } from "../sri";

export const BasicTarget = z.looseObject({
  type: z.enum([
    "TextTargetIntegrity",
    "VisibleTextTargetIntegrity",
    "HtmlTargetIntegrity",
  ]),
  integrity: SubresourceIntegrity,
  cssSelector: z.string().describe("CSS selector"),
});

export type BasicTarget = z.infer<typeof BasicTarget>;
