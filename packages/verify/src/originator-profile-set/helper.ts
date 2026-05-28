import { generateKey } from "@originator-profile/cryptography";
import { CoreProfile, OriginatorProfileSet } from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import { addYears, fromUnixTime, getUnixTime } from "date-fns";
import {
  certificate,
  cp,
  opId,
  patch,
  VerifyResultFactory,
  wmp,
} from "../helper";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
export const signOptions = { issuedAt, expiredAt };
export const verifyResult = VerifyResultFactory(issuedAt, expiredAt);

/**
 * OPS テスト用の共通フィクスチャを生成する
 *
 * - authority: CP 発行者 (CP/WMP の署名鍵)
 * - certifier: PA 発行者 (PA の署名鍵)
 * - originator: CP/PA/WMP の保有者
 */
export async function buildOpsFixture() {
  const authority = await generateKey();
  const certifier = await generateKey();

  const authorityCp: CoreProfile = patch(cp, [
    {
      op: "replace",
      path: ["credentialSubject", "id"],
      value: opId.authority,
    },
    {
      op: "add",
      path: ["credentialSubject", "jwks", "keys", 0],
      value: authority.publicKey,
    },
  ]);
  const certifierCp: CoreProfile = patch(cp, [
    {
      op: "replace",
      path: ["credentialSubject", "id"],
      value: opId.certifier,
    },
    {
      op: "add",
      path: ["credentialSubject", "jwks", "keys", 0],
      value: certifier.publicKey,
    },
  ]);

  const authorityOp = {
    core: await signCp(authorityCp, authority.privateKey, signOptions),
  };
  const certifierOp = {
    core: await signCp(certifierCp, authority.privateKey, signOptions),
  };
  const originatorOp = {
    core: await signCp(cp, authority.privateKey, signOptions),
    annotations: [
      await signJwtVc(certificate, certifier.privateKey, signOptions),
    ],
    media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
  };
  const ops: OriginatorProfileSet = [authorityOp, certifierOp, originatorOp];

  return {
    authority,
    certifier,
    authorityCp,
    certifierCp,
    authorityOp,
    certifierOp,
    originatorOp,
    ops,
  };
}
