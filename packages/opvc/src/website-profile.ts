import { parseExpirationDate } from "@originator-profile/core";
import type { UnsignedWebsiteProfile } from "@originator-profile/model";
import { fetchAndSetDigestSri } from "@originator-profile/sign";
import { addYears, getUnixTime } from "date-fns";

/**
 * 未署名 Website Profile の取得
 * @param uwsp 未署名 Website Profile オブジェクト
 * @return 未署名 Website Profile オブジェクト
 */
export async function unsignedWsp(
  uwsp: UnsignedWebsiteProfile,
  {
    issuedAt: issuedAtDateOrString = new Date(),
    expiredAt: expiredAtDateOrString = addYears(new Date(), 1),
  }: {
    issuedAt?: Date | string;
    expiredAt?: Date | string;
  },
): Promise<UnsignedWebsiteProfile> {
  const issuedAt: Date = new Date(issuedAtDateOrString);

  const expiredAt: Date =
    typeof expiredAtDateOrString === "string"
      ? parseExpirationDate(expiredAtDateOrString)
      : expiredAtDateOrString;

  await fetchAndSetDigestSri("sha256", uwsp.credentialSubject.image);

  return {
    iss: uwsp.issuer,
    sub: uwsp.credentialSubject.id,
    iat: getUnixTime(issuedAt),
    exp: getUnixTime(expiredAt),
    ...uwsp,
  };
}
