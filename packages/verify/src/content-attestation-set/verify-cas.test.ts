import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import {
  ContentAttestationSet,
  CoreProfile,
  OriginatorProfileSet,
} from "@originator-profile/model";
import { VcValidator } from "@originator-profile/securing-mechanism";
import { createIntegrity, signCa, signCp } from "@originator-profile/sign";
import { addYears, fromUnixTime, getUnixTime } from "date-fns";
import { beforeEach, describe, expect, test } from "vitest";
import { CaInvalid } from "../content-attestation";
import {
  article,
  caUrl,
  cp,
  opId,
  patch,
  VerifyResultFactory,
} from "../helper";
import { verifyIntegrity } from "../integrity";
import {
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
} from "../originator-profile-set";
import { CasVerifyFailed } from "./errors";
import { verifyCas } from "./verify-cas";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
const signOptions = { issuedAt, expiredAt };
const verifyResult = VerifyResultFactory(issuedAt, expiredAt);

describe("CASの検証", async () => {
  beforeEach(() => {
    document.body.textContent = "ok";
  });
  const authority = await generateKey();
  const originator = await generateKey();
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
  const originatorCp: CoreProfile = patch(cp, [
    {
      op: "add",
      path: ["credentialSubject", "jwks", "keys", 0],
      value: originator.publicKey,
    },
  ]);
  const authorityOp = {
    core: await signCp(authorityCp, authority.privateKey, signOptions),
  };
  const originatorOp = {
    core: await signCp(originatorCp, authority.privateKey, signOptions),
  };
  const ops: OriginatorProfileSet = [authorityOp, originatorOp];
  const articleUca = patch(article, [
    {
      op: "add",
      path: ["target", 0],
      value: {
        type: "TextTargetIntegrity",
        content: `<!doctype html>
            <html lang="ja">
              <head>
                <title>ok</title>
              </head>
              <body>
                ok
              </body>
            </html>
          `,
        cssSelector: "body",
      },
    },
  ]);
  test("CASの検証に成功", async () => {
    const ca = await signCa(articleUca, originator.privateKey, signOptions);
    const cas: ContentAttestationSet = [ca];
    const verifyOp = OpsVerifier(ops, {
      core: {
        issuer: opId.authority,
        keys: LocalKeys({ keys: [authority.publicKey] }),
      },
      profileAnnotationIssuerRegistration: { issuer: opId.authority },
    });
    const verifiedOps = await verifyOp();
    expect(verifiedOps).not.instanceof(OpsInvalid);
    expect(verifiedOps).not.instanceof(OpsVerifyFailed);
    const result = await verifyCas(
      cas,
      // @ts-expect-error 'OpsVerificationResult' is not assignable to parameter of type 'VerifiedOps'
      verifiedOps,
      caUrl,
      verifyIntegrity,
      VcValidator,
    );
    expect(result).not.instanceof(CasVerifyFailed);
    expect(result).toStrictEqual([
      {
        attestation: verifyResult.create(
          patch(article, [
            {
              op: "add",
              path: ["target", 0],
              value: await createIntegrity("sha256", {
                type: "TextTargetIntegrity",
                cssSelector: "body",
              }),
            },
          ]),
          ca,
          originator.publicKey,
          true,
        ),
        main: false,
      },
    ]);
  });
  test("CAの形式が不正で検証に失敗", async () => {
    const invalidCa = await signCa(
      patch(articleUca, [
        {
          op: "replace",
          path: ["type", 1],
          value: "InvalidContentAttestationType",
        },
      ]),
      originator.privateKey,
      signOptions,
    );
    const invalidCas: ContentAttestationSet = [invalidCa];
    const verifyOp = OpsVerifier(ops, {
      core: {
        issuer: opId.authority,
        keys: LocalKeys({ keys: [authority.publicKey] }),
      },
      profileAnnotationIssuerRegistration: { issuer: opId.authority },
    });
    const verifiedOps = await verifyOp();
    expect(verifiedOps).not.instanceof(OpsInvalid);
    expect(verifiedOps).not.instanceof(OpsVerifyFailed);
    const result = await verifyCas(
      invalidCas,
      // @ts-expect-error 'OpsVerificationResult' is not assignable to parameter of type 'VerifiedOps'
      verifiedOps,
      caUrl,
      verifyIntegrity,
      VcValidator,
    );
    expect(result).instanceof(CasVerifyFailed);
    // @ts-expect-error verify failed Cas
    const { result: resultCa } = result;
    expect(resultCa[0].attestation).instanceOf(CaInvalid);
    expect(resultCa[0].attestation.message).toEqual(
      "Content Attestation validate failed",
    );
  });
});
