import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { DateTimeStamp } from "../date-time-stamp";
import { OpId } from "../op-id";
import { ProfileAnnotationProperties } from "./profile-annotation-properties";

export const ProfileAnnotation = z.looseObject({
  "@context": OpCipContext,
  type: z.tuple([
    z.literal("VerifiableCredential"),
    z.literal("ProfileAnnotation"),
  ]),
  issuer: OpId,
  validFrom: DateTimeStamp.optional().describe(
    "Validity period start and time",
  ),
  validUntil: DateTimeStamp.optional().describe("Validity period end and time"),
  credentialSubject: ProfileAnnotationProperties,
});

export type ProfileAnnotation = z.infer<typeof ProfileAnnotation>;
