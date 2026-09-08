import { ArticleLike } from "./types";
import { ContentAttestation } from "@originator-profile/model";

export function isArticleLike<CA extends ContentAttestation>(
  sub: CA["credentialSubject"],
): sub is ArticleLike {
  return ["Article", "Advertorial"].includes(sub.type);
}
