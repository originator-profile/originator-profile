import {
  type Jwk,
  UnsignedWebsiteProfile,
  UnsignedWebsiteProfileSet,
} from "@originator-profile/model";
import {
  fetchAndSetDigestSri,
  signWsp,
  UnsignedWebsiteProfileInput,
} from "@originator-profile/sign";
import { getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";
import { parseDates, type TimingOptions } from "./timing-options.ts";

/**
 * 未署名 Website Profile の取得
 *
 * 配列を渡した場合、全要素が同一の `issuer` と `credentialSubject.id` を持ち、
 * `@context` の `@language` がそれぞれ異なることを検証します。
 *
 * @param uwsp 未署名 Website Profile オブジェクト (単一または配列)
 * @throws {BadRequestError} 配列入力の整合性違反や入力が UnsignedWebsiteProfile スキーマに適合しない場合
 * @return 未署名 Website Profile (配列入力時は配列)
 */
export async function unsignedWsp<U extends UnsignedWebsiteProfileInput>(
  uwsp: U,
  options: TimingOptions,
): Promise<
  U extends unknown[] ? UnsignedWebsiteProfileSet : UnsignedWebsiteProfile
> {
  type Result = U extends unknown[]
    ? UnsignedWebsiteProfileSet
    : UnsignedWebsiteProfile;
  const timing = parseDates(options);
  async function build(u: UnsignedWebsiteProfile) {
    await fetchAndSetDigestSri("sha256", u.credentialSubject.image);
    return {
      ...u,
      iss: u.issuer,
      sub: u.credentialSubject.id,
      iat: getUnixTime(timing.issuedAt),
      exp: getUnixTime(timing.expiredAt),
    } as UnsignedWebsiteProfile;
  }
  try {
    UnsignedWebsiteProfileInput.parse(uwsp);
    if (Array.isArray(uwsp)) {
      const us = await Promise.all(uwsp.map(build));
      return us as Result;
    }
    const u = await build(uwsp);
    return u as Result;
  } catch (e) {
    throw new BadRequestError((e as Error).message, { cause: e });
  }
}

/**
 * Website Profile への署名
 *
 * 配列を渡した場合、各要素を個別に署名して JWT 文字列の配列を返します。
 *
 * @param uwsp 未署名 Website Profile (単一または配列)
 * @param privateKey プライベート鍵
 * @throws {BadRequestError} 配列入力の整合性違反や入力が UnsignedWebsiteProfile スキーマに適合しない場合
 * @return 単一入力時は JWT 文字列、配列入力時は JWT 文字列の配列
 */
export async function sign<U extends UnsignedWebsiteProfileInput>(
  uwsp: U,
  privateKey: Jwk,
  options: TimingOptions = {},
): Promise<U extends unknown[] ? string[] : string> {
  const timing = parseDates(options);
  try {
    return await signWsp(uwsp, privateKey, timing);
  } catch (e) {
    throw new BadRequestError((e as Error).message, { cause: e });
  }
}
