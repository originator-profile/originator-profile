import { type Jwk, UnsignedWebsiteProfile } from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { fetchAndSetDigestSri } from "@originator-profile/sign";
import { getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";
import { parseDates, type TimingOptions } from "./timing-options.ts";

function extractLanguage(uwsp: UnsignedWebsiteProfile): string {
  const tail = uwsp["@context"].at(-1);
  if (
    tail === undefined ||
    typeof tail !== "object" ||
    !("@language" in tail) ||
    typeof tail["@language"] !== "string"
  ) {
    throw new BadRequestError(
      "Each UnsignedWebsiteProfile must declare @language in @context.",
    );
  }
  return tail["@language"];
}

function assertConsistentSet(uwsps: UnsignedWebsiteProfile[]): void {
  if (uwsps.length === 0) {
    throw new BadRequestError(
      "At least one UnsignedWebsiteProfile is required.",
    );
  }

  const [head] = uwsps;
  const languages = new Set<string>();

  for (const uwsp of uwsps) {
    if (uwsp.issuer !== head.issuer) {
      throw new BadRequestError(
        "All UnsignedWebsiteProfile entries must share the same issuer.",
      );
    }
    if (uwsp.credentialSubject.id !== head.credentialSubject.id) {
      throw new BadRequestError(
        "All UnsignedWebsiteProfile entries must share the same credentialSubject.id.",
      );
    }

    const language = extractLanguage(uwsp);
    if (languages.has(language)) {
      throw new BadRequestError(
        `Duplicate @language "${language}" in UnsignedWebsiteProfile set.`,
      );
    }
    languages.add(language);
  }
}

async function buildUnsignedWsp(
  uwsp: UnsignedWebsiteProfile,
  { issuedAt, expiredAt }: { issuedAt: Date; expiredAt: Date },
): Promise<UnsignedWebsiteProfile> {
  try {
    UnsignedWebsiteProfile.parse(uwsp);
    await fetchAndSetDigestSri("sha256", uwsp.credentialSubject.image);
  } catch (e) {
    throw new BadRequestError((e as Error).message);
  }

  return {
    ...uwsp,
    iss: uwsp.issuer,
    sub: uwsp.credentialSubject.id,
    iat: getUnixTime(issuedAt),
    exp: getUnixTime(expiredAt),
  };
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
export async function unsignedWsp(
  uwsp: UnsignedWebsiteProfile,
  options: TimingOptions,
): Promise<UnsignedWebsiteProfile>;
export async function unsignedWsp(
  uwsp: UnsignedWebsiteProfile[],
  options: TimingOptions,
): Promise<UnsignedWebsiteProfile[]>;
export async function unsignedWsp(
  uwsp: UnsignedWebsiteProfile | UnsignedWebsiteProfile[],
  options: TimingOptions,
): Promise<UnsignedWebsiteProfile | UnsignedWebsiteProfile[]>;
export async function unsignedWsp(
  uwsp: UnsignedWebsiteProfile | UnsignedWebsiteProfile[],
  options: TimingOptions,
): Promise<UnsignedWebsiteProfile | UnsignedWebsiteProfile[]> {
  const timing = parseDates(options);

  if (Array.isArray(uwsp)) {
    assertConsistentSet(uwsp);
    return Promise.all(uwsp.map((item) => buildUnsignedWsp(item, timing)));
  }

  return buildUnsignedWsp(uwsp, timing);
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
export async function sign(
  uwsp: UnsignedWebsiteProfile,
  privateKey: Jwk,
  options?: TimingOptions,
): Promise<string>;
export async function sign(
  uwsp: UnsignedWebsiteProfile[],
  privateKey: Jwk,
  options?: TimingOptions,
): Promise<string[]>;
export async function sign(
  uwsp: UnsignedWebsiteProfile | UnsignedWebsiteProfile[],
  privateKey: Jwk,
  options: TimingOptions = {},
): Promise<string | string[]> {
  const timing = parseDates(options);

  if (Array.isArray(uwsp)) {
    assertConsistentSet(uwsp);
    return Promise.all(
      uwsp.map(async (item) => {
        const payload = await buildUnsignedWsp(item, timing);
        return signJwtVc(payload, privateKey, timing);
      }),
    );
  }

  const payload = await buildUnsignedWsp(uwsp, timing);
  return signJwtVc(payload, privateKey, timing);
}
