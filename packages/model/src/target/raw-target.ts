import { z } from "zod";

export const RawTarget = z
  .looseObject({
    type: z
      .enum([
        "TextTargetIntegrity",
        "VisibleTextTargetIntegrity",
        "HtmlTargetIntegrity",
        "ExternalResourceTargetIntegrity",
      ])
      .describe("Target Integrity type (e.g., TextTargetIntegrity)"),
    content: z
      .union([
        z.array(z.string().describe("Content body (text/html or URL)")),
        z.string().describe("Content body (text/html or URL)"),
      ])
      .optional(),
    cssSelector: z.string().optional().describe("CSS selector"),
  })
  .describe("Raw target");

export type RawTarget = z.infer<typeof RawTarget>;
