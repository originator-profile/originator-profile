import { createThumbprint } from "@originator-profile/cryptography";
import type { Jwk } from "@originator-profile/model";
import { getUnixTime } from "date-fns";
import { base64url, exportJWK, importJWK, SignJWT } from "jose";
import { isJwtSigner, type JwtSigner, type KeyMaterial } from "./signer";

type SignableVc = {
  issuer: string;
  credentialSubject: { id: string };
};

function isJwk(keyMaterial: KeyMaterial): keyMaterial is Jwk {
  return "kty" in keyMaterial;
}

async function resolveKid(
  keyMaterial: KeyMaterial,
  alg: string,
): Promise<string> {
  if (isJwk(keyMaterial)) {
    return keyMaterial.kid ?? (await createThumbprint(keyMaterial, alg));
  }
  try {
    const jwk = await exportJWK(keyMaterial);
    return await createThumbprint(jwk, alg);
  } catch {
    throw new Error(
      "Could not derive kid from the key (it may be non-extractable). Specify options.kid explicitly.",
    );
  }
}

async function resolveAlgAndKid(
  signer: KeyMaterial | JwtSigner,
  options: { alg?: string; kid?: string },
): Promise<{ alg: string; kid: string }> {
  if (isJwtSigner(signer)) {
    if (options.alg !== undefined && options.alg !== signer.alg) {
      throw new Error(
        `options.alg ("${options.alg}") must match signer.alg ("${signer.alg}").`,
      );
    }
    return { alg: signer.alg, kid: options.kid ?? signer.kid };
  }
  const alg = options.alg ?? "ES256";
  return { alg, kid: options.kid ?? (await resolveKid(signer, alg)) };
}

/**
 * VC への署名
 * @param vc VC オブジェクト
 * @param signer プライベートキー (Jwk/CryptoKey/KeyObject)、または HSM・KMS・WebAuthn等の外部署名者 (JwtSigner)
 * @return JWT でエンコードされた VC
 */
export async function signJwtVc<T extends SignableVc>(
  vc: T,
  signer: KeyMaterial | JwtSigner,
  options: {
    alg?: string;
    kid?: string;
    issuedAt: Date;
    expiredAt: Date;
  },
): Promise<string> {
  const { issuedAt, expiredAt } = options;
  const { alg, kid } = await resolveAlgAndKid(signer, options);
  const header = { alg, kid, typ: "vc+jwt", cty: "vc" };

  if (isJwtSigner(signer)) {
    const claims = {
      ...vc,
      iss: vc.issuer,
      sub: vc.credentialSubject.id,
      iat: getUnixTime(issuedAt),
      exp: getUnixTime(expiredAt),
    };
    const encodedHeader = base64url.encode(JSON.stringify(header));
    const encodedPayload = base64url.encode(JSON.stringify(claims));
    const signingInput = new TextEncoder().encode(
      `${encodedHeader}.${encodedPayload}`,
    );
    const signature = await signer.sign(signingInput);
    return `${encodedHeader}.${encodedPayload}.${base64url.encode(signature)}`;
  }

  const key = isJwk(signer) ? await importJWK(signer, alg) : signer;
  return await new SignJWT(vc)
    .setProtectedHeader(header)
    .setIssuer(vc.issuer)
    .setSubject(vc.credentialSubject.id)
    .setIssuedAt(getUnixTime(issuedAt))
    .setExpirationTime(getUnixTime(expiredAt))
    .sign(key);
}
