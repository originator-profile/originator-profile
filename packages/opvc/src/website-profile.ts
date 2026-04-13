import { parseExpirationDate } from "@originator-profile/core";
import { UnsignedWebsiteProfile, type Jwk } from "@originator-profile/model";
import { fetchAndSetDigestSri, signWsp } from "@originator-profile/sign";
import { addYears, getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";

type WebsiteProfileTimingOptions = {
  issuedAt?: Date | string;
  expiredAt?: Date | string;
};

function assertValidDate(
  value: Date,
  fieldName: "issuedAt" | "expiredAt",
): void {
  if (Number.isNaN(value.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date.`);
  }
}

function parseDates({
  issuedAt: issuedAtDateOrString = new Date(),
  expiredAt: expiredAtDateOrString = addYears(new Date(), 1),
}: WebsiteProfileTimingOptions): {
  issuedAt: Date;
  expiredAt: Date;
} {
  const issuedAt: Date = new Date(issuedAtDateOrString);

  const expiredAt: Date =
    typeof expiredAtDateOrString === "string"
      ? parseExpirationDate(expiredAtDateOrString)
      : new Date(expiredAtDateOrString);

  assertValidDate(issuedAt, "issuedAt");
  assertValidDate(expiredAt, "expiredAt");

  return { issuedAt, expiredAt };
}

/**
 * 未署名 Website Profile の取得
 * @param uwsp 未署名 Website Profile オブジェクト
 * @throws {Error} 入力が UnsignedWebsiteProfile スキーマに適合しない場合
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
  UnsignedWebsiteProfile.parse(uwsp);

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

/**
 * Website Profile への署名
 * @param uwsp 未署名 Website Profile オブジェクト
 * @param privateKey プライベート鍵
 * @throws {BadRequestError} 入力が UnsignedWebsiteProfile スキーマに適合しない場合/検証対象のコンテンツが存在しない/コンテンツにアクセスできない/Integrityの計算に失敗
 * @return Website Profile
 */
export async function sign(
  uwsp: UnsignedWebsiteProfile,
  privateKey: Jwk,
  options: WebsiteProfileTimingOptions = {},
): Promise<string> {
  const { issuedAt, expiredAt } = parseDates(options);
  const payload = await unsignedWsp(uwsp, { issuedAt, expiredAt });

  return await signWsp(payload, privateKey, {
    issuedAt,
    expiredAt,
  });
}
