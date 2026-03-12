import { z } from "zod";

/** @deprecated */
const OgWebsite = z
  .looseObject({
    type: z.literal("website"),
    url: z.string().optional(),
    title: z.string().optional(),
    image: z.string().optional(),
    description: z.string().optional(),
    "https://schema.org/author": z.string().optional(),
    "https://schema.org/editor": z.string().optional(),
    "https://schema.org/datePublished": z.string().datetime().optional(),
    "https://schema.org/dateModified": z.string().datetime().optional(),
  })
  .describe("Website");

/** @deprecated */
type OgWebsite = z.infer<typeof OgWebsite>;

export default OgWebsite;
