import { z } from "zod";

function isValidOrigin(val: string): boolean {
  try {
    return new URL(val).origin === val;
  } catch {
    return false;
  }
}

const Item = z.stringFormat("origin", isValidOrigin, {
  error:
    "Origin MUST be in the format scheme://host[:port] (do not include a trailing slash or path. e.g. https://example.com)",
});

/**
 * 後方互換性のため 2026-09-01 まで許容
 * Content Attestation では allowedOrigin は非推奨です。代わりに allowedUrl を使用してください。
 */
export const AllowedOrigin = z
  .union([Item, z.array(Item).min(1)])
  .describe(
    "@deprecated allowedOrigin is deprecated in Content Attestation. Use allowedUrl instead. Supported until September 2026.\n\n" +
      "The [origin](https://www.rfc-editor.org/rfc/rfc6454#section-7) of the information being asserted.",
  );

export type AllowedOrigin = z.infer<typeof AllowedOrigin>;
