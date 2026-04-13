import { createThumbprint } from "@originator-profile/cryptography";
import { Jwk } from "@originator-profile/model";
import { getUnixTime } from "date-fns";
import { importJWK, SignJWT } from "jose";

type SignableVc = {
  issuer: string;
  credentialSubject: { id: string };
};

/**
 * VC への署名
 * @param vc VC オブジェクト
 * @param privateKey プライベートキー
 * @return JWT でエンコードされた VC
 */
export async function signJwtVc<T extends SignableVc>(
  vc: T,
  privateKey: Jwk,
  options: {
    alg?: string;
    issuedAt: Date;
    expiredAt: Date;
  },
): Promise<string> {
  const payload = vc;
  const { alg = "ES256", issuedAt, expiredAt } = options;
  const header = {
    alg,
    kid: privateKey.kid ?? (await createThumbprint(privateKey, alg)),
    typ: "vc+jwt",
    cty: "vc",
  };

  const privateKeyImported = await importJWK(privateKey, alg);
  const jwt = await new SignJWT(payload)
    .setProtectedHeader(header)
    .setIssuer(vc.issuer)
    .setSubject(vc.credentialSubject.id)
    .setIssuedAt(getUnixTime(issuedAt))
    .setExpirationTime(getUnixTime(expiredAt))
    .sign(privateKeyImported);
  return jwt;
}
