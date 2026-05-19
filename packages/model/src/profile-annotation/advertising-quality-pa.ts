import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ProfileAnnotation } from "./profile-annotation";
import { ProfileAnnotationProperties } from "./profile-annotation-properties";

export const AdvertisingQualityPAProperties =
  ProfileAnnotationProperties.extend({
    type: z.literal("AdvertisingQualityCertificate"),
    verifier: z.string().optional().describe("Verifier name"),
  });

export const AdvertisingQualityPA = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: AdvertisingQualityPAProperties,
});

export type AdvertisingQualityPA = z.infer<typeof AdvertisingQualityPA>;
