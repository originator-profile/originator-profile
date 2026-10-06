import { z } from "zod";

function isValidUrlPattern(val: string): boolean {
  try {
    const { protocol, hostname } = new URLPattern(val);
    return (
      (protocol === "https" ||
        (protocol === "http" && hostname === "localhost")) &&
      // RFC 9525 Section 6.3: wildcard only as the entire left-most label
      z.regexes.hostname.test(hostname.replace(/^\*\./, ""))
    );
  } catch {
    return false;
  }
}

const Item = z.stringFormat("url-pattern", isValidUrlPattern, {
  error:
    "Invalid URL Pattern string (the scheme must be https and the hostname must be fixed, e.g. https://example.com/*)",
});

export const AllowedUrl = z
  .union([Item, z.array(Item).min(1)])
  .describe(
    "The URL for which information is asserted by this Content Attestation. The string MUST be a URL Pattern string with the https scheme (http is allowed only for localhost) and a fixed hostname, optionally prefixed with `*.`. It MUST NOT be an empty array.",
  );

export type AllowedUrl = z.infer<typeof AllowedUrl>;
