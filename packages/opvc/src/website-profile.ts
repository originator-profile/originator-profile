import { type Jwk, UnsignedWebsiteProfile } from "@originator-profile/model";
import { fetchAndSetDigestSri, signWsp } from "@originator-profile/sign";
import { getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";
import { z } from "zod";
import { parseDates, type TimingOptions } from "./timing-options.ts";

const UnsignedWebsiteProfileInput = z.union([
  UnsignedWebsiteProfile,
  z.array(UnsignedWebsiteProfile),
]);

type UnsignedWebsiteProfileInput = z.infer<typeof UnsignedWebsiteProfileInput>;

// 詳細な構造検証は UnsignedWebsiteProfile.parse が担う
function extractLanguage(uwsp: UnsignedWebsiteProfile): string {
  const tail = uwsp["@context"].at(-1);
  return (tail as { "@language": string })["@language"];
}

function assertConsistentSet(uwsps: UnsignedWebsiteProfile[]): void {
  if (uwsps.length === 0) {
    throw new BadRequestError(
      "At least one UnsignedWebsiteProfile is required.",
    );
  }

  const [head] = uwsps;
  const languages = new Set<string>();

  for (const [index, uwsp] of uwsps.entries()) {
    if (uwsp.issuer !== head.issuer) {
      throw new BadRequestError(
        `UnsignedWebsiteProfile entries must share the same issuer (entries[${index}] differs from entries[0]).`,
      );
    }
    if (uwsp.credentialSubject.id !== head.credentialSubject.id) {
      throw new BadRequestError(
        `UnsignedWebsiteProfile entries must share the same credentialSubject.id (entries[${index}] differs from entries[0]).`,
      );
    }

    const language = extractLanguage(uwsp);
    if (languages.has(language)) {
      throw new BadRequestError(
        `Duplicate @language "${language}" at entries[${index}].`,
      );
    }
    languages.add(language);
  }
}

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
  U extends unknown[] ? UnsignedWebsiteProfile[] : UnsignedWebsiteProfile
> {
  type Result = U extends unknown[]
    ? UnsignedWebsiteProfile[]
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
      assertConsistentSet(uwsp);
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
    UnsignedWebsiteProfileInput.parse(uwsp);
    if (Array.isArray(uwsp)) {
      assertConsistentSet(uwsp);
    }
    return await signWsp(uwsp, privateKey, timing);
  } catch (e) {
    throw new BadRequestError((e as Error).message, { cause: e });
  }
}
