import { z } from "zod";
import { Image, RawImage } from "./image";
import { WebsiteProfile } from "./website-profile";

export const UnsignedWebsiteProfile = z.looseObject({
  ...WebsiteProfile.shape,
  credentialSubject: z.union([
    ...WebsiteProfile.shape.credentialSubject.options,
    WebsiteProfile.shape.credentialSubject.options.at(-1)?.safeExtend({
      image: z.union([RawImage, Image]),
    }) ?? z.never(),
  ]),
});

export type UnsignedWebsiteProfile = z.infer<typeof UnsignedWebsiteProfile>;
