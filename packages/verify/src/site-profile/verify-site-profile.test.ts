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
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
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
    sites: [await signJwtVc(wsp, originator.privateKey, signOptions)],
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
      sites: [verifyResult.create(wsp, sp.sites[0], originator.publicKey)],
    });
  });

  test("SiteProfileの検証に成功(バリデーターつき)", async () => {
    const verify = SpVerifier(
      sp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
      { validator: VcValidator },
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
      sites: [
        verifyResult.create(wsp, sp.sites[0], originator.publicKey, true),
      ],
    });
  });

  test("SiteProfileの検証に成功(origin部分は検証しない)", async () => {
    const verify = SpVerifier(
      sp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://not-exisiting.example.org",
      { verifyOrigin: false },
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
      sites: [verifyResult.create(wsp, sp.sites[0], originator.publicKey)],
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
      { validator: VcValidator },
    );
    const resultSp = await verify();

    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
    // @ts-expect-error verify failed Sp
    const { result: resultOp } = resultSp.result.originators;
    expect(resultOp[2]).instanceOf(OpVerifyFailed);
    expect(resultOp[2].result.core).instanceOf(VcValidateFailed);
    expect(resultOp[2].result.core.message).toContain("CoreProfile");
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
      sites: [await signJwtVc(wsp, evil.privateKey, signOptions)],
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
      sites: [evilWsp],
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
    const { originators: resultOps, sites } = resultSp.result;
    const resultWsp = sites?.[0];
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
        path: ["sites", 0],
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
    const { originators: resultOps, sites } = resultSp.result;
    const resultWsp = sites?.[0];
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
      sites: [
        await signJwtVc(
          wspWithNullCredentialSubjectUrl,
          originator.privateKey,
          signOptions,
        ),
      ],
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
      sites: [
        await signJwtVc(
          wspWithNullCredentialSubjectUrl,
          originator.privateKey,
          signOptions,
        ),
      ],
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

  test("複数のWSP(sites配列)の検証に成功", async () => {
    const wspEn: WebsiteProfile = patch(wsp, [
      {
        op: "replace",
        path: ["@context", 3, "@language"],
        value: "en",
      },
      {
        op: "replace",
        path: ["credentialSubject", "name"],
        value: "Example Website EN",
      },
    ]);

    const wspFr: WebsiteProfile = patch(wsp, [
      {
        op: "replace",
        path: ["@context", 3, "@language"],
        value: "fr",
      },
      {
        op: "replace",
        path: ["credentialSubject", "name"],
        value: "Example Website FR",
      },
    ]);

    const multiSp: SiteProfile = {
      originators: ops,
      sites: [
        await signJwtVc(wsp, originator.privateKey, signOptions),
        await signJwtVc(wspEn, originator.privateKey, signOptions),
        await signJwtVc(wspFr, originator.privateKey, signOptions),
      ],
    };

    const verify = SpVerifier(
      multiSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
    );
    const resultSp = await verify();

    expect(resultSp).not.instanceOf(SiteProfileInvalid);
    expect(resultSp).not.instanceOf(SiteProfileVerifyFailed);
    expect(resultSp).toMatchObject({
      originators: expect.any(Array),
      sites: expect.any(Array),
    });
    // @ts-expect-error verified sp
    expect(resultSp.sites).toHaveLength(3);
    // @ts-expect-error verified sp
    expect(resultSp.sites[0].doc.credentialSubject.name).toBe(
      "Example Website",
    );
    // @ts-expect-error verified sp
    expect(resultSp.sites[1].doc.credentialSubject.name).toBe(
      "Example Website EN",
    );
    // @ts-expect-error verified sp
    expect(resultSp.sites[2].doc.credentialSubject.name).toBe(
      "Example Website FR",
    );
  });

  test("複数のWSPのうち一つだけ署名検証に失敗", async () => {
    const evil = await generateKey();
    const wspEn: WebsiteProfile = patch(wsp, [
      {
        op: "replace",
        path: ["@context", 3, "@language"],
        value: "en",
      },
    ]);

    const multiSp: SiteProfile = {
      originators: ops,
      sites: [
        await signJwtVc(wsp, originator.privateKey, signOptions),
        await signJwtVc(wspEn, evil.privateKey, signOptions), // 悪意のある署名
      ],
    };

    const verify = SpVerifier(
      multiSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
    );
    const resultSp = await verify();

    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
    // @ts-expect-error verify failed Sp
    const { sites } = resultSp.result;
    expect(sites).toHaveLength(2);
    expect(sites[0]).toMatchObject({ doc: wsp });
    expect(sites[1]).instanceOf(VcVerifyFailed);
  });

  test("複数のWSPのうち一つだけオリジンが一致しない", async () => {
    const wspDifferentOrigin: WebsiteProfile = patch(wsp, [
      {
        op: "replace",
        path: ["credentialSubject", "allowedOrigin"],
        value: ["https://different-origin.example.org"],
      },
    ]);

    const multiSp: SiteProfile = {
      originators: ops,
      sites: [
        await signJwtVc(wsp, originator.privateKey, signOptions),
        await signJwtVc(wspDifferentOrigin, originator.privateKey, signOptions),
      ],
    };

    const verify = SpVerifier(
      multiSp,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
      "https://originator.example.org",
    );
    const resultSp = await verify();

    expect(resultSp).instanceOf(SiteProfileVerifyFailed);
    // @ts-expect-error verify failed Sp
    const { sites } = resultSp.result;
    expect(sites).toHaveLength(2);
    expect(sites[0]).toMatchObject({ doc: wsp });
    expect(sites[1]).instanceOf(Error);
    expect(sites[1].message).toBe("Origin not allowed");
  });

  describe("WSP image digestSRI検証 (2027年まではwarn扱い)", () => {
    let warnSpy: MockInstance;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test("digestSRIがない場合、warnが出るが検証は成功する", async () => {
      const wspWithImage: WebsiteProfile = patch(wsp, [
        {
          op: "add",
          path: ["credentialSubject", "image"],
          value: { id: "https://example.org/image.png" },
        },
      ]);

      const result = await SpVerifier(
        {
          originators: ops,
          sites: [
            await signJwtVc(wspWithImage, originator.privateKey, signOptions),
          ],
        },
        LocalKeys({ keys: [authority.publicKey] }),
        opId.authority,
        "https://originator.example.org",
      )();

      expect(result).not.instanceOf(SiteProfileInvalid);
      expect(result).not.instanceOf(SiteProfileVerifyFailed);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("digestSRI is missing"),
      );
    });

    test("digestSRIが不正な場合、warnが出るが検証は成功する", async () => {
      const wspWithBadImage: WebsiteProfile = patch(wsp, [
        {
          op: "add",
          path: ["credentialSubject", "image"],
          value: {
            id: "https://example.org/image.png",
            digestSRI: "sha256-invalid",
          },
        },
      ]);

      const result = await SpVerifier(
        {
          originators: ops,
          sites: [
            await signJwtVc(
              wspWithBadImage,
              originator.privateKey,
              signOptions,
            ),
          ],
        },
        LocalKeys({ keys: [authority.publicKey] }),
        opId.authority,
        "https://originator.example.org",
      )();

      expect(result).not.instanceOf(SiteProfileInvalid);
      expect(result).not.instanceOf(SiteProfileVerifyFailed);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("digestSRI verification failed"),
      );
    });
  });
});
