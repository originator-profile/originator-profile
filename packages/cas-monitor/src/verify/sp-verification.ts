import { SiteProfile } from "@originator-profile/model";
import { SpVerifier, getTupledKeys } from "@originator-profile/verify";
import { transformEndpoint } from "../fetch/fetch-html.js";
import { CoreProfileIssuersDebugResult } from "../types.js";

export async function runSpVerification(
  sp: SiteProfile,
  coreProfileIssuers: CoreProfileIssuersDebugResult,
  url: string,
) {
  if (!URL.canParse(url)) return new Error("URL Invalid");
  const websiteOrigin = new URL(transformEndpoint(url)).origin;
  const [issuer, keys] = getTupledKeys(coreProfileIssuers.decoded);
  const spVerifier = SpVerifier(
    { ...sp, originators: [...coreProfileIssuers.ops, ...sp.originators] },
    keys,
    issuer,
    websiteOrigin,
  );
  return await spVerifier();
}
