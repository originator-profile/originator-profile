import { z } from "zod";

/** @deprecated */
const Advertisement = z
  .looseObject({
    type: z.literal("advertisement"),
    url: z.string().optional().describe("掲載先 URL"),
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional().describe("広告のサムネイル表示用 URL"),
  })
  .describe("Advertisement");

/** @deprecated */
type Advertisement = z.infer<typeof Advertisement>;

export default Advertisement;
