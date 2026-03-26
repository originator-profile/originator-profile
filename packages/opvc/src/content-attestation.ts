import { parseExpirationDate } from "@originator-profile/core";
import {
  UnsignedContentAttestation,
  type Jwk,
} from "@originator-profile/model";
import {
  fetchAndSetDigestSri,
  fetchAndSetTargetIntegrity,
  signCa,
} from "@originator-profile/sign";
import { addYears, getUnixTime } from "date-fns";
import { BadRequestError } from "http-errors-enhanced";
import { documentProvider } from "./document-provider.ts";

/**
 * Content Attestation への署名
 * @param uca 未署名 Content Attestation オブジェクト
 * @param privateKey プライベート鍵
 * @throws {Error} 入力が UnsignedContentAttestation スキーマに適合しない場合
 * @return Content Attestation
 */
export async function sign(
  uca: UnsignedContentAttestation,
  privateKey: Jwk,
  {
    issuedAt: issuedAtDateOrString = new Date(),
    expiredAt: expiredAtDateOrString = addYears(new Date(), 1),
  }: {
    issuedAt?: Date | string;
    expiredAt?: Date | string;
  },
): Promise<string> {
  UnsignedContentAttestation.parse(uca);

  const issuedAt: Date = new Date(issuedAtDateOrString);

  const expiredAt: Date =
    typeof expiredAtDateOrString === "string"
      ? parseExpirationDate(expiredAtDateOrString)
      : expiredAtDateOrString;

  uca.credentialSubject.id ??= `urn:uuid:${crypto.randomUUID()}`;

  return await signCa(uca, privateKey, {
    issuedAt,
    expiredAt,
    documentProvider,
  });
}

/**
 * 未署名 Content Attestation の取得
 * @param uca 未署名 Content Attestation オブジェクト
 * @throws {Error} 入力が UnsignedContentAttestation スキーマに適合しない場合
 * @throws {BadRequestError} 検証対象のコンテンツが存在しない/コンテンツにアクセスできない/Integrityの計算に失敗
 * @return 未署名 Content Attestation オブジェクト
 */
export async function unsignedCa(
  uca: UnsignedContentAttestation,
  {
    issuedAt: issuedAtDateOrString = new Date(),
    expiredAt: expiredAtDateOrString = addYears(new Date(), 1),
  }: {
    issuedAt?: Date | string;
    expiredAt?: Date | string;
  },
): Promise<UnsignedContentAttestation> {
  UnsignedContentAttestation.parse(uca);

  const issuedAt: Date = new Date(issuedAtDateOrString);

  const expiredAt: Date =
    typeof expiredAtDateOrString === "string"
      ? parseExpirationDate(expiredAtDateOrString)
      : expiredAtDateOrString;

  uca.credentialSubject.id ??= `urn:uuid:${crypto.randomUUID()}`;

  try {
    await fetchAndSetDigestSri("sha256", uca.credentialSubject.image);
    await fetchAndSetTargetIntegrity("sha256", uca, documentProvider);
  } catch (e) {
    throw new BadRequestError((e as Error).message);
  }

  const payload = {
    iss: uca.issuer,
    sub: uca.credentialSubject.id,
    iat: getUnixTime(issuedAt),
    exp: getUnixTime(expiredAt),
    ...uca,
  };

  return payload;
}
