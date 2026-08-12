import {
  UnsignedWebsiteProfile,
  UnsignedWebsiteProfileSet,
} from "@originator-profile/model";
import {
  type JwtSigner,
  type KeyMaterial,
  signJwtVc,
} from "@originator-profile/securing-mechanism";
import type { HashAlgorithm } from "websri";
import { z } from "zod";
import { fetchAndSetDigestSri } from "./integrity/";

type SignWspOptions = {
  alg?: string;
  kid?: string;
  issuedAt?: Date;
  expiredAt: Date;
  integrityAlg?: HashAlgorithm;
};

export const UnsignedWebsiteProfileInput = z.union([
  UnsignedWebsiteProfile,
  UnsignedWebsiteProfileSet,
]);

export type UnsignedWebsiteProfileInput = z.infer<
  typeof UnsignedWebsiteProfileInput
>;

/**
 * Website Profile への署名
 *
 * 配列を渡した場合、各要素を個別に署名して JWT 文字列の配列を返します。
 *
 * @param uwsp 未署名 Website Profile オブジェクト (単一または配列)
 * @param signer プライベート鍵、または HSM・KMS・WebAuthn等の外部署名者 (JwtSigner)
 * @return JWT でエンコードされた Website Profile (配列入力時は配列)
 * @throws {Error} UnsignedWebsiteProfile(Set) スキーマに適合しない場合
 */
export async function signWsp<
  U extends UnsignedWebsiteProfile | UnsignedWebsiteProfileSet,
>(
  uwsp: U,
  signer: KeyMaterial | JwtSigner,
  {
    alg,
    kid,
    issuedAt = new Date(),
    expiredAt,
    integrityAlg = "sha256",
  }: SignWspOptions,
): Promise<U extends unknown[] ? string[] : string> {
  type Result = U extends unknown[] ? string[] : string;
  UnsignedWebsiteProfileInput.parse(uwsp);
  async function sign(item: UnsignedWebsiteProfile): Promise<string> {
    await fetchAndSetDigestSri(integrityAlg, item.credentialSubject.image);
    return await signJwtVc(item, signer, { alg, kid, issuedAt, expiredAt });
  }
  if (Array.isArray(uwsp)) {
    const wsps = await Promise.all(uwsp.map(sign));
    return wsps as Result;
  }
  const wsp = await sign(uwsp);
  return wsp as Result;
}
