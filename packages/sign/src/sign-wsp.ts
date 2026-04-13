import type { Jwk, UnsignedWebsiteProfile } from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import type { HashAlgorithm } from "websri";
import { type DocumentProvider, fetchAndSetDigestSri } from "./integrity/";

/**
 * Website Profile への署名
 * @param uwsp 未署名 Website Profile オブジェクト
 * @param privateKey プライベート鍵
 * @return JWT でエンコードされた Website Profile
 */
export async function signWsp(
  uwsp: UnsignedWebsiteProfile,
  privateKey: Jwk,
  {
    alg = "ES256",
    issuedAt = new Date(),
    expiredAt,
    integrityAlg = "sha256",
  }: {
    alg?: string;
    issuedAt?: Date;
    expiredAt: Date;
    integrityAlg?: HashAlgorithm;
    documentProvider?: DocumentProvider;
  },
): Promise<string> {
  await fetchAndSetDigestSri(integrityAlg, uwsp.credentialSubject.image);

  return await signJwtVc(uwsp, privateKey, { alg, issuedAt, expiredAt });
}
