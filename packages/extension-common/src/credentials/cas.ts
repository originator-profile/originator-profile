import { ContentAttestation } from "@originator-profile/model";
import { VerifiedCas } from "@originator-profile/verify";

/** CAS の列挙 */
export function listCas<T extends ContentAttestation>(
  cas: VerifiedCas<T>,
  type: "Article" | "Advertorial" | "OnlineAd" | "Main" | "Other" | "All",
): VerifiedCas<T> {
  let filtered: VerifiedCas<T>;
  switch (type) {
    case "Article":
    case "Advertorial":
    case "OnlineAd": {
      filtered = cas.filter(
        (ca) => ca.attestation.doc.credentialSubject.type === type,
      );
      break;
    }
    case "Main": {
      filtered = cas.filter((ca) => ca.main);
      break;
    }
    case "All":
    default: {
      filtered = cas;
      break;
    }
  }
  return filtered;
}
