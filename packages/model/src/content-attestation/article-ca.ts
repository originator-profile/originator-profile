import { z } from "zod";
import { AllowedUrl } from "../allowed-url";
import { OpCipContext } from "../context/op-cip-context";
import { DateTimeStamp } from "../date-time-stamp";
import { Image } from "../image";
import { ContentAttestation } from "./content-attestation";

const subject = z.object({
  id: z.url().describe("CA ID"),
  type: z.literal("Article"),
  headline: z.string().describe("Title of the content."),
  description: z
    .string()
    .describe("A description of the content (plain text)."),
  image: Image.optional(),
  datePublished: DateTimeStamp.optional().describe("Publication date and time"),
  dateModified: DateTimeStamp.optional().describe(
    "Last modified date and time",
  ),
  author: z.array(z.string()).optional().describe("Author names"),
  editor: z.array(z.string()).optional().describe("Editor names"),
  genre: z.string().optional().describe("Genre"),
});

export const ArticleCA = ContentAttestation.extend({
  "@context": OpCipContext,
  credentialSubject: subject,
  allowedUrl: AllowedUrl,
}).refine((obj) => !("allowedOrigin" in obj), {
  error: "allowedOrigin is not allowed in ArticleCA",
});

export type ArticleCA = z.infer<typeof ArticleCA>;
