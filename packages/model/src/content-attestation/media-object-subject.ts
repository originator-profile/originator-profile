import { z } from "zod";
import { DateTimeStamp } from "../date-time-stamp";
import { Image } from "../image";

/** Image / Video / Audio / Document CA に共通する credentialSubject のプロパティ */
export const MediaObjectSubject = z.object({
  id: z.url().describe("CA ID"),
  name: z.string().describe("Title of the content."),
  description: z
    .string()
    .describe("A description of the content (plain text)."),
  image: Image.optional(),
  dateCreated: DateTimeStamp.optional().describe("Creation date and time"),
  dateModified: DateTimeStamp.optional().describe(
    "Last modified date and time",
  ),
  creator: z.array(z.string()).optional().describe("Creator names"),
  encodingFormat: z
    .string()
    .optional()
    .describe("Encoding format of the content (MIME type)"),
  genre: z.string().optional().describe("Genre"),
});
