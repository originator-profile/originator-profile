import type { Jwk } from "@originator-profile/model";
import type { CryptoKey, KeyObject } from "jose";

/**
 * 鍵材料を外部に渡さない不透明な署名者
 *
 * HSM・セキュアエレメント・クラウドKMS(AWS KMS, Google Cloud KMS, Azure Key Vault等)・
 * WebAuthn/FIDO2など、秘密鍵をハードウェア境界外に取り出せない署名環境向けの注入口。
 */
export type JwtSigner = {
  /** JWS alg */
  alg: string;
  /** JWS kid (鍵材料を持たないためサムプリントによるフォールバック計算ができない) */
  kid: string;
  /**
   * signingInput (base64url(header) + "." + base64url(payload) の ASCII バイト列) に対する
   * 生の署名バイト列 (JOSE 形式。例えば ES256 なら r||s の固定長結合) を返す。
   */
  sign: (signingInput: Uint8Array) => Promise<Uint8Array>;
};

/** ソフトウェア鍵として直接扱える鍵材料 */
export type KeyMaterial = Jwk | CryptoKey | KeyObject;

/** signer が JwtSigner (不透明な署名者) かどうかを判定する */
export function isJwtSigner(
  signer: KeyMaterial | JwtSigner,
): signer is JwtSigner {
  return (
    !("kty" in signer) && "sign" in signer && typeof signer.sign === "function"
  );
}
