import { SupportedVerifiedCa } from "./types";

export const getContentType = (ca: SupportedVerifiedCa): string => {
  if (ca.main) return "ContentType_MainContent";

  const type = ca.attestation.doc.credentialSubject.type;

  switch (type) {
    case "Article":
      return "ContentType_Article";
    case "OnlineAd":
      return "ContentType_Advertisement";
    case "Advertorial":
      return "ContentType_Advertorial";
    default:
      return "ContentType_Unknown";
  }
};
