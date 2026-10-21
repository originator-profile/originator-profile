import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ProfileAnnotation } from "./profile-annotation";
import { ProfileAnnotationProperties } from "./profile-annotation-properties";

/**
 * @deprecated The Advertising Quality Certificate PA is deprecated in OPB.
 */
export const AdvertisingQualityPAProperties =
  ProfileAnnotationProperties.extend({
    type: z.literal("AdvertisingQualityCertificate"),
    verifier: z.string().optional().describe("Verifier name"),
  });

/**
 * @deprecated The Advertising Quality Certificate PA is deprecated in OPB.
 */
export const AdvertisingQualityPA = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: AdvertisingQualityPAProperties,
});

/**
 * @deprecated The Advertising Quality Certificate PA is deprecated in OPB.
 */
export type AdvertisingQualityPA = z.infer<typeof AdvertisingQualityPA>;
