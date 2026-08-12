import { CoreProfile } from "@originator-profile/model";
import {
  type JwtSigner,
  type KeyMaterial,
  signJwtVc,
} from "@originator-profile/securing-mechanism";

/**
 * CP への署名
 * @param cp CoreProfile オブジェクト
 * @param signer プライベート鍵、または HSM・KMS・WebAuthn等の外部署名者 (JwtSigner)
 * @return JWT でエンコードされた CP
 */
export async function signCp(
  cp: CoreProfile,
  signer: KeyMaterial | JwtSigner,
  options: {
    alg?: string;
    kid?: string;
    issuedAt: Date;
    expiredAt: Date;
  },
): Promise<string> {
  return signJwtVc(cp, signer, options);
}
