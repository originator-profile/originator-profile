import { LocalKeys } from "@originator-profile/cryptography";
import { OpVc } from "@originator-profile/model";
import {
  JwtVcVerifier,
  UnverifiedJwtVc,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { type MappedKeys } from "../keys";
import { CoreProfileNotFound } from "./errors";

/** OP (CP を除く) 署名検証者 */
export function OpVerifier<T extends OpVc>(
  paOrWmpIssuerKeys: MappedKeys,
  vc: UnverifiedJwtVc<T>,
  validator?: VcValidator<VerifiedJwtVc<T>>,
): JwtVcVerifier<T> | (() => Promise<CoreProfileNotFound<T>>) {
  const issuer = vc.doc.issuer;
  const jwks = paOrWmpIssuerKeys[issuer];
  if (!jwks) {
    return async () =>
      new CoreProfileNotFound(`Missing Core Profile (${issuer})`, vc);
  }
  const cpKeys = LocalKeys(jwks);
  return JwtVcVerifier<T>(cpKeys, issuer, validator);
}
