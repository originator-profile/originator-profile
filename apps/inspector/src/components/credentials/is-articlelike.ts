import { ArticleLike } from "@originator-profile/extension-common";
import { ContentAttestation } from "@originator-profile/model";

export function isArticleLike<CA extends ContentAttestation>(
  sub: CA["credentialSubject"],
): sub is ArticleLike {
  return ["Article", "Advertorial"].includes(sub.type);
}
