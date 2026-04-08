import { z } from "zod";

export const Description = z.union([
  z.string(),
  z.looseObject({
    text: z.string().describe("Text value."),
    encodingFormat: z
      .enum(["text/plain", "text/html"])
      .describe(
        "MIME type. Allowed values: 'text/plain' and 'text/html' (only br, p, ol, ul, li allowed).",
      ),
  }),
]);

export type Description = z.infer<typeof Description>;
