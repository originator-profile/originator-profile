import { z } from "zod";
import { UnsignedWebsiteProfile } from "./unsigned-website-profile";

export const UnsignedWebsiteProfileSet = z
  .array(UnsignedWebsiteProfile)
  .min(1, "At least one UnsignedWebsiteProfile is required.")
  .superRefine((value, ctx) => {
    const [head] = value;
    const languages = new Set<string>();

    for (const [index, uwsp] of value.entries()) {
      if (uwsp.issuer !== head.issuer) {
        ctx.addIssue({
          code: "custom",
          message: `UnsignedWebsiteProfile entries must share the same issuer (entries[${index}] differs from entries[0]).`,
          path: [index, "issuer"],
        });
      }
      if (uwsp.credentialSubject.id !== head.credentialSubject.id) {
        ctx.addIssue({
          code: "custom",
          message: `UnsignedWebsiteProfile entries must share the same credentialSubject.id (entries[${index}] differs from entries[0]).`,
          path: [index, "credentialSubject", "id"],
        });
      }

      const tail = uwsp["@context"].at(-1) as { "@language": string };
      const language = tail["@language"];
      if (languages.has(language)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate @language "${language}" at entries[${index}].`,
          path: [index, "@context", uwsp["@context"].length - 1, "@language"],
        });
      }
      languages.add(language);
    }
  });

export type UnsignedWebsiteProfileSet = z.infer<
  typeof UnsignedWebsiteProfileSet
>;
