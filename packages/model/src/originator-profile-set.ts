import { z } from "zod";

export const OriginatorProfileSetItem = z.looseObject({
  core: z.string().describe("Core Profile"),
  annotations: z
    .array(z.string().describe("Profile Annotation"))
    .optional()
    .describe("An array of Profile Annotation"),
  media: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Web Media Profile or an array of Web Media Profile"),
});

export const OriginatorProfileSet = z.array(OriginatorProfileSetItem);

export type OriginatorProfileSetItem = z.infer<typeof OriginatorProfileSetItem>;
export type OriginatorProfileSet = z.infer<typeof OriginatorProfileSet>;

export default OriginatorProfileSet;
