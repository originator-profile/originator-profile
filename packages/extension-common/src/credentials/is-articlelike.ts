import { ContentAttestation } from "@originator-profile/model";
import { ArticleLike } from "./types";

export function isArticleLike<CA extends ContentAttestation>(
  sub: CA["credentialSubject"],
): sub is ArticleLike {
  return ["Article", "Advertorial"].includes(sub.type);
}
