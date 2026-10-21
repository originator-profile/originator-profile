import { z } from "zod";
import { OpCipContext } from "../context/op-cip-context";
import { ProfileAnnotation } from "./profile-annotation";
import { ProfileAnnotationProperties } from "./profile-annotation-properties";

export const MembershipPAProperties = ProfileAnnotationProperties.extend({
  type: z.literal("Membership"),
});

export const MembershipPA = ProfileAnnotation.extend({
  "@context": OpCipContext,
  credentialSubject: MembershipPAProperties,
});

export type MembershipPA = z.infer<typeof MembershipPA>;
