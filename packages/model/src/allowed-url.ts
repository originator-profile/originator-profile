import { z } from "zod";

function isValidUrlPattern(val: string): boolean {
  try {
    new URLPattern(val);
    return true;
  } catch {
    return false;
  }
}

const Item = z.stringFormat("url-pattern", isValidUrlPattern, {
  error:
    "Invalid URL Pattern string (* alone is not allowed. Specify a URL Pattern string such as https://example.com/*)",
});

export const AllowedUrl = z
  .union([Item, z.array(Item).min(1)])
  .describe(
    "The URL for which information is asserted by this Content Attestation. The string MUST be a URL Pattern string. It MUST NOT be an empty array.",
  );

export type AllowedUrl = z.infer<typeof AllowedUrl>;
