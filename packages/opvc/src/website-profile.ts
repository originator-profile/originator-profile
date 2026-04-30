import { UnsignedWebsiteProfile, type Jwk } from "@originator-profile/model";
import { fetchAndSetDigestSri, signWsp } from "@originator-profile/sign";
import { getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";
import { parseDates, type TimingOptions } from "./timing-options.ts";

/**
 * 未署名 Website Profile の取得
 * @param uwsp 未署名 Website Profile オブジェクト
 * @throws {Error} 入力が UnsignedWebsiteProfile スキーマに適合しない場合
 * @return 未署名 Website Profile オブジェクト
 */
export async function unsignedWsp(
  uwsp: UnsignedWebsiteProfile,
  timingOptions: TimingOptions,
): Promise<UnsignedWebsiteProfile> {
  const { issuedAt, expiredAt } = parseDates(timingOptions);

  try {
    UnsignedWebsiteProfile.parse(uwsp);

    await fetchAndSetDigestSri("sha256", uwsp.credentialSubject.image);
  } catch (e) {
    throw new BadRequestError((e as Error).message);
  }

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
  options: TimingOptions = {},
): Promise<string> {
  const { issuedAt, expiredAt } = parseDates(options);
  const payload = await unsignedWsp(uwsp, { issuedAt, expiredAt });

  return await signWsp(payload, privateKey, {
    issuedAt,
    expiredAt,
  });
}
