import { z } from "zod";
import { AllowedOrigin } from "./allowed-origin";
import { OpCipContext } from "./context/op-cip-context";
import { Image } from "./image";
import { OpId } from "./op-id";

/** @deprecated 後方互換性のため 2026-10-01 まで url プロパティを許容 */
const deprecatedSubject = z.looseObject({
  id: z.url().describe("Web site origin (format: https://<hostname>)"),
  type: z.literal("WebSite"),
  name: z.string().describe("The name of the Web site."),
  image: Image.optional(),
  description: z.string().optional().describe("A description of the Web site."),
  url: AllowedOrigin,
});

const subject = z.looseObject({
  id: z
    .url()
    .describe(
      "It MUST be the Web site URL. If the same content exists on multiple URLs, specify the most representative URL.",
    ),
  type: z.literal("WebSite"),
  name: z.string().describe("The name of the Web site."),
  image: Image.optional(),
  description: z.string().optional().describe("A description of the Web site."),
  allowedOrigin: AllowedOrigin,
});

export const WebsiteProfile = z.looseObject({
  "@context": OpCipContext,
  type: z.tuple([
    z.literal("VerifiableCredential"),
    z.literal("WebsiteProfile"),
  ]),
  issuer: OpId,
  credentialSubject: z.union([deprecatedSubject, subject]),
});

export type WebsiteProfile = z.infer<typeof WebsiteProfile>;
