import { z } from "zod";

/** @deprecated */
const Logo = z
  .array(
    z.object({
      url: z.string().describe("Logo image URL"),
      isMain: z
        .boolean()
        .describe("true: main logo image, false: logo image candidate"),
    }),
  )
  .describe("Logo");

/** @deprecated */
type Logo = z.infer<typeof Logo>;

export default Logo;
