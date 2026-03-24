import { z } from "zod";
import { Image, RawImage } from "./image";
import { WebsiteProfile } from "./website-profile";

export const UnsignedWebsiteProfile = WebsiteProfile.and(
  z.object({
    credentialSubject: z.object({
      image: z.union([RawImage, Image]),
    }),
  }),
);

export type UnsignedWebsiteProfile = z.infer<typeof UnsignedWebsiteProfile>;
