import { ContentAttestationSet } from "@originator-profile/model";
import {
  VerifiedOps,
  verifyCas,
  verifyIntegrity,
} from "@originator-profile/verify";
import {
  buildVerificationDocument,
  transformEndpoint,
} from "../fetch/fetch-html.js";

export async function runCasVerification(
  cas: ContentAttestationSet,
  ops: VerifiedOps,
  url: string,
  html: string,
) {
  if (!URL.canParse(url)) return new Error("URL Invalid");
  const doc = buildVerificationDocument(html, url);
  const verifiedCas = await verifyCas(
    cas,
    ops,
    transformEndpoint(url),
    (content) =>
      verifyIntegrity(
        content,
        doc,
        (resource: string | URL | RequestInfo, options?: RequestInit) => {
          const request = new Request(resource);
          return fetch(request.url, options);
        },
      ),
  );

  return verifiedCas;
}
