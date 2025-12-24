import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import {
  CoreProfile,
  OriginatorProfileSet,
  SiteProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import {
  signJwtVc,
  VcValidateFailed,
  VcValidator,
  VcVerifyFailed,
} from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import { addYears, fromUnixTime, getUnixTime } from "date-fns";
import { describe, expect, test } from "vitest";
import {
  certificate,
  cp,
  opId,
  patch,
  VerifyResultFactory,
  wmp,
  wsp,
} from "../helper";
import {
  CoreProfileNotFound,
  OpVerifyFailed,
} from "../originator-profile-set/errors";
import { SiteProfileInvalid, SiteProfileVerifyFailed } from "./verify-errors";
import { SpVerifier } from "./verify-site-profile";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
const signOptions = { issuedAt, expiredAt };
const verifyResult = VerifyResultFactory(issuedAt, expiredAt);

describe("Site Profileの検証", async () => {
  const authority = await generateKey();
  const certifier = await generateKey();
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
  const certifierOp = {
    core: await signCp(certifierCp, authority.privateKey, signOptions),
  };
  const originatorOp = {
    core: await signCp(originatorCp, authority.privateKey, signOptions),
    annotations: [
      await signJwtVc(certificate, certifier.privateKey, signOptions),
    ],
    media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
  };
  const ops: OriginatorProfileSet = [authorityOp, certifierOp, originatorOp];
  const sp = {
    originators: ops,
    credential: await signJwtVc(wsp, originator.privateKey, signOptions),
  } satisfies SiteProfile;

  test("SiteProfileの検証に成功", async () => {
    const verify = SpVerifier(
      sp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
    );
    const resultSp = await verify();

    expect(resultSp).not.instanceOf(SiteProfileInvalid);
    expect(resultSp).not.instanceOf(SiteProfileVerifyFailed);
    expect(resultSp).toStrictEqual({
      originators: [
        {
          core: verifyResult.create(
            authorityCp,
            authorityOp.core,
            authority.publicKey,
          ),
          annotations: undefined,
          media: undefined,
        },
        {
          core: verifyResult.create(
            certifierCp,
            certifierOp.core,
            authority.publicKey,
          ),
          annotations: undefined,
          media: undefined,
        },
        {
          core: verifyResult.create(
            originatorCp,
            originatorOp.core,
            authority.publicKey,
          ),
          annotations: [
            verifyResult.create(
              certificate,
              originatorOp.annotations[0],
              certifier.publicKey,
            ),
          ],
          media: [
            verifyResult.create(
              wmp,
              originatorOp.media[0],
              authority.publicKey,
            ),
          ],
        },
      ],
      credential: verifyResult.create(wsp, sp.credential, originator.publicKey),
    });
  });

  test("SiteProfileの検証に成功(バリデーターつき)", async () => {
    const verify = SpVerifier(
      sp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
      true,
      VcValidator,
    );
    const resultSp = await verify();

    expect(resultSp).not.instanceOf(SiteProfileInvalid);
    expect(resultSp).not.instanceOf(SiteProfileVerifyFailed);
    expect(resultSp).toStrictEqual({
      originators: [
        {
          core: verifyResult.create(
            authorityCp,
            authorityOp.core,
            authority.publicKey,
            true,
          ),
          annotations: undefined,
          media: undefined,
        },
        {
          core: verifyResult.create(
            certifierCp,
            certifierOp.core,
            authority.publicKey,
            true,
          ),
          annotations: undefined,
          media: undefined,
        },
        {
          core: verifyResult.create(
            originatorCp,
            originatorOp.core,
            authority.publicKey,
            true,
          ),
          annotations: [
            verifyResult.create(
              certificate,
              originatorOp.annotations[0],
              certifier.publicKey,
              true,
            ),
          ],
          media: [
            verifyResult.create(
              wmp,
              originatorOp.media[0],
              authority.publicKey,
              true,
            ),
          ],
        },
      ],
      credential: verifyResult.create(
        wsp,
        sp.credential,
        originator.publicKey,
        true,
      ),
    });
  });

  test("SiteProfileの検証に成功(origin部分は検証しない)", async () => {
    const verify = SpVerifier(
      sp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://not-exisiting.example.org",
      false,
    );
    const resultSp = await verify();

    expect(resultSp).not.instanceOf(SiteProfileInvalid);
    expect(resultSp).not.instanceOf(SiteProfileVerifyFailed);
    expect(resultSp).toStrictEqual({
      originators: [
        {
          core: verifyResult.create(
            authorityCp,
            authorityOp.core,
            authority.publicKey,
          ),
          annotations: undefined,
          media: undefined,
        },
        {
          core: verifyResult.create(
            certifierCp,
            certifierOp.core,
            authority.publicKey,
          ),
          annotations: undefined,
          media: undefined,
        },
        {
          core: verifyResult.create(
            originatorCp,
            originatorOp.core,
            authority.publicKey,
          ),
          annotations: [
            verifyResult.create(
              certificate,
              originatorOp.annotations[0],
              certifier.publicKey,
            ),
          ],
          media: [
            verifyResult.create(
              wmp,
              originatorOp.media[0],
              authority.publicKey,
            ),
          ],
        },
      ],
      credential: verifyResult.create(wsp, sp.credential, originator.publicKey),
    });
  });

  test("CPが不正な形式で検証に失敗", async () => {
    const invalidCp = await signCp(
      patch(cp, [
        { op: "replace", path: ["type", 1], value: "InvalidCoreProfileType" },
      ]),
      authority.privateKey,
      signOptions,
    );
    const invalidOps: OriginatorProfileSet = patch(ops, [
      {
        op: "replace",
        path: [2, "core"],
        value: invalidCp,
      },
    ]);
    const invalidSp = {
      ...sp,
      originators: invalidOps,
    };
    const verify = SpVerifier(
      invalidSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
      true,
      VcValidator,
    );
    const resultSp = await verify();

    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
    // @ts-expect-error verify failed Sp
    const { result: resultOp } = resultSp.result.originators;
    expect(resultOp[2]).instanceOf(OpVerifyFailed);
    expect(resultOp[2].result.core).instanceOf(VcValidateFailed);
    expect(resultOp[2].result.core.message).toEqual(
      "data/type/1 must be equal to constant",
    );
  });

  test("SiteProfileのうちOPS部分の署名の検証に失敗", async () => {
    const evil = await generateKey();
    const evilCp = await signCp(cp, evil.privateKey, signOptions);
    const evilOps: OriginatorProfileSet = patch(ops, [
      {
        op: "replace",
        path: [2, "core"],
        value: evilCp,
      },
    ]);
    const evilSp = {
      originators: evilOps,
      credential: await signJwtVc(wsp, evil.privateKey, signOptions),
    };
    const verify = SpVerifier(
      evilSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
    );
    const resultSp = await verify();

    expect(resultSp).not.instanceOf(SiteProfileInvalid);
    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
    // @ts-expect-error verify failed Sp
    const { result: resultOp } = resultSp.result.originators;
    expect(resultOp[0]).toStrictEqual({
      core: verifyResult.create(
        authorityCp,
        authorityOp.core,
        authority.publicKey,
      ),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).toStrictEqual({
      core: verifyResult.create(
        certifierCp,
        certifierOp.core,
        authority.publicKey,
      ),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[2]).instanceOf(OpVerifyFailed);
    expect(resultOp[2].result.core).instanceOf(VcVerifyFailed);
    expect(resultOp[2].result.annotations[0]).toStrictEqual(
      verifyResult.create(
        certificate,
        originatorOp.annotations[0],
        certifier.publicKey,
      ),
    );
    expect(resultOp[2].result.media).toStrictEqual([
      verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
    ]);
  });

  test("SiteProfileのうちWSP部分の署名の検証に失敗", async () => {
    const evil = await generateKey();
    const evilWsp = await signJwtVc(wsp, evil.privateKey, signOptions);
    const evilSp = {
      originators: ops,
      credential: evilWsp,
    };
    const verify = SpVerifier(
      evilSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
    );
    const resultSp = await verify();

    expect(resultSp).not.instanceOf(SiteProfileInvalid);
    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
    // @ts-expect-error verify failed Sp
    const { originators: resultOps, credential: resultWsp } = resultSp.result;
    expect(resultOps).toStrictEqual([
      {
        core: verifyResult.create(
          authorityCp,
          authorityOp.core,
          authority.publicKey,
        ),
        annotations: undefined,
        media: undefined,
      },
      {
        core: verifyResult.create(
          certifierCp,
          certifierOp.core,
          authority.publicKey,
        ),
        annotations: undefined,
        media: undefined,
      },
      {
        core: verifyResult.create(
          originatorCp,
          originatorOp.core,
          authority.publicKey,
        ),
        annotations: [
          verifyResult.create(
            certificate,
            originatorOp.annotations[0],
            certifier.publicKey,
          ),
        ],
        media: [
          verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
        ],
      },
    ]);
    expect(resultWsp).instanceOf(VcVerifyFailed);
  });

  test("WSPのイシュアーと一致する保有者のCPがない", async () => {
    const invalidWsp = patch(wsp, [
      {
        op: "replace",
        path: ["issuer"],
        value: opId.invalid,
      },
    ]);
    const invalidCredential = await signJwtVc(
      invalidWsp,
      originator.privateKey,
      signOptions,
    );
    const invalidSp = patch(sp, [
      {
        op: "replace",
        path: ["credential"],
        value: invalidCredential,
      },
    ]);
    const verify = SpVerifier(
      invalidSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
    );
    const resultSp = await verify();

    expect(resultSp).instanceOf(SiteProfileInvalid);
    // @ts-expect-error invalid Sp
    const { originators: resultOps, credential: resultWsp } = resultSp.result;
    expect(resultOps[0]).toStrictEqual({
      core: verifyResult.create(
        authorityCp,
        authorityOp.core,
        authority.publicKey,
      ),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOps[1]).toStrictEqual({
      core: verifyResult.create(
        certifierCp,
        certifierOp.core,
        authority.publicKey,
      ),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOps[2]).toStrictEqual({
      core: verifyResult.create(
        originatorCp,
        originatorOp.core,
        authority.publicKey,
      ),
      annotations: [
        verifyResult.create(
          certificate,
          originatorOp.annotations[0],
          certifier.publicKey,
        ),
      ],
      media: [
        verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
      ],
    });
    expect(resultWsp).instanceOf(CoreProfileNotFound);
  });

  test("WSPのURLとオリジンが一致しない時に検証に失敗するか", async () => {
    const verify = SpVerifier(
      sp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://localhost",
    );
    const resultSp = await verify();
    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
  });

  test("WSPのallowedOriginがnullの時に検証に失敗するか", async () => {
    const wspWithNullCredentialSubjectUrl: WebsiteProfile = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        {
          "@language": "ja",
        },
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: opId.originator,
      credentialSubject: {
        id: opId.originator,
        type: "WebSite",
        name: "Example Website",
        description: "Example Website Description",
        allowedOrigin: "null",
      },
    };

    const evilSp: SiteProfile = {
      originators: ops,
      credential: await signJwtVc(
        wspWithNullCredentialSubjectUrl,
        originator.privateKey,
        signOptions,
      ),
    };

    const verify = SpVerifier(
      evilSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://localhost",
    );
    const resultSp = await verify();
    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
  });

  test("オリジンがnullの時に検証に失敗するか", async () => {
    const verify = SpVerifier(
      sp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "null",
    );
    const resultSp = await verify();
    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
  });

  test("WSPのallowedOriginとオリジンが共にnullの時に検証に失敗するか", async () => {
    const wspWithNullCredentialSubjectUrl: WebsiteProfile = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        {
          "@language": "ja",
        },
      ],
      type: ["VerifiableCredential", "WebsiteProfile"],
      issuer: opId.originator,
      credentialSubject: {
        id: opId.originator,
        type: "WebSite",
        name: "Example Website",
        description: "Example Website Description",
        allowedOrigin: "null",
      },
    };

    const evilSp: SiteProfile = {
      originators: ops,
      credential: await signJwtVc(
        wspWithNullCredentialSubjectUrl,
        originator.privateKey,
        signOptions,
      ),
    };

    const verify = SpVerifier(
      evilSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "null",
    );
    const resultSp = await verify();
    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
  });
});
