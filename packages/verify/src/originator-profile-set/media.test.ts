import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import {
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  signJwtVc,
  VcVerifyFailed,
} from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { certificate, cp, opId, patch, wmp } from "../helper";
import {
  OpInvalid,
  OpsInvalid,
  OpsVerifyFailed,
  OpVerifyFailed,
} from "./errors";
import { buildOpsFixture, signOptions } from "./helper";
import { OpsVerifier } from "./verify-ops";

describe("Web Media Profile の検証", async () => {
  const { authority, certifier, authorityOp, certifierOp } =
    await buildOpsFixture();

  test("複数のWMP(media配列)の検証に成功", async () => {
    const wmpEn = patch(wmp, [
      {
        op: "replace",
        path: ["@context", 3, "@language"],
        value: "en",
      },
      {
        op: "replace",
        path: ["credentialSubject", "name"],
        value: "Example OP Holder EN",
      },
    ]);

    const wmpFr = patch(wmp, [
      {
        op: "replace",
        path: ["@context", 3, "@language"],
        value: "fr",
      },
      {
        op: "replace",
        path: ["credentialSubject", "name"],
        value: "Example OP Holder FR",
      },
    ]);

    const multiMediaOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(certificate, certifier.privateKey, signOptions),
      ],
      media: [
        await signJwtVc(wmp, authority.privateKey, signOptions),
        await signJwtVc(wmpEn, authority.privateKey, signOptions),
        await signJwtVc(wmpFr, authority.privateKey, signOptions),
      ],
    };

    const multiMediaOps: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      multiMediaOp,
    ];

    const verify = OpsVerifier(
      multiMediaOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).not.instanceOf(OpsVerifyFailed);
    expect(resultOps).toMatchObject([
      expect.any(Object),
      expect.any(Object),
      {
        core: expect.any(Object),
        annotations: expect.any(Array),
        media: expect.any(Array),
      },
    ]);
    // @ts-expect-error verified ops
    expect(resultOps[2].media).toHaveLength(3);
    // @ts-expect-error verified ops
    expect(resultOps[2].media[0].doc.credentialSubject.name).toBe(
      "Example OP Holder",
    );
    // @ts-expect-error verified ops
    expect(resultOps[2].media[1].doc.credentialSubject.name).toBe(
      "Example OP Holder EN",
    );
    // @ts-expect-error verified ops
    expect(resultOps[2].media[2].doc.credentialSubject.name).toBe(
      "Example OP Holder FR",
    );
  });

  test("複数のWMPのうち一つだけ署名検証に失敗", async () => {
    const evil = await generateKey();
    const wmpEn = patch(wmp, [
      {
        op: "replace",
        path: ["@context", 3, "@language"],
        value: "en",
      },
    ]);

    const multiMediaOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(certificate, certifier.privateKey, signOptions),
      ],
      media: [
        await signJwtVc(wmp, authority.privateKey, signOptions),
        await signJwtVc(wmpEn, evil.privateKey, signOptions), // 悪意のある署名
      ],
    };

    const multiMediaOps: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      multiMediaOp,
    ];

    const verify = OpsVerifier(
      multiMediaOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).instanceOf(OpsVerifyFailed);
    // @ts-expect-error verify failed Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[2]).instanceOf(OpVerifyFailed);
    expect(resultOp[2].result.media).toHaveLength(2);
    expect(resultOp[2].result.media[0]).toMatchObject({ doc: wmp });
    expect(resultOp[2].result.media[1]).instanceOf(VcVerifyFailed);
  });

  test("複数のWMPのうち一つだけ保有者が不一致", async () => {
    const wmpInvalid = patch(wmp, [
      {
        op: "replace",
        path: ["credentialSubject", "id"],
        value: opId.invalid,
      },
    ]);

    const multiMediaOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(certificate, certifier.privateKey, signOptions),
      ],
      media: [
        await signJwtVc(wmp, authority.privateKey, signOptions),
        await signJwtVc(wmpInvalid, authority.privateKey, signOptions),
      ],
    };

    const multiMediaOps: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      multiMediaOp,
    ];

    const verify = OpsVerifier(
      multiMediaOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[2]).instanceOf(OpInvalid);
  });

  describe("media logo digestSRI検証 (2027年まではwarn扱い)", () => {
    let warnSpy: MockInstance;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test("digestSRIがない場合、warnが出るが検証は成功する", async () => {
      const wmpWithLogo: WebMediaProfile = patch(wmp, [
        {
          op: "add",
          path: ["credentialSubject", "logo"],
          value: { id: "https://example.org/logo.svg" },
        },
      ]);

      const result = await OpsVerifier(
        [
          authorityOp,
          certifierOp,
          {
            core: await signCp(cp, authority.privateKey, signOptions),
            annotations: [
              await signJwtVc(certificate, certifier.privateKey, signOptions),
            ],
            media: [
              await signJwtVc(wmpWithLogo, authority.privateKey, signOptions),
            ],
          },
        ],
        LocalKeys({ keys: [authority.publicKey] }),
        opId.authority,
      )();

      expect(result).not.instanceOf(OpsInvalid);
      expect(result).not.instanceOf(OpsVerifyFailed);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("digestSRI is missing"),
      );
    });

    test("digestSRIが不正な場合、warnが出るが検証は成功する", async () => {
      const wmpWithBadLogo: WebMediaProfile = patch(wmp, [
        {
          op: "add",
          path: ["credentialSubject", "logo"],
          value: {
            id: "https://example.org/logo.svg",
            digestSRI: "sha256-invalid",
          },
        },
      ]);

      const result = await OpsVerifier(
        [
          authorityOp,
          certifierOp,
          {
            core: await signCp(cp, authority.privateKey, signOptions),
            annotations: [
              await signJwtVc(certificate, certifier.privateKey, signOptions),
            ],
            media: [
              await signJwtVc(
                wmpWithBadLogo,
                authority.privateKey,
                signOptions,
              ),
            ],
          },
        ],
        LocalKeys({ keys: [authority.publicKey] }),
        opId.authority,
      )();

      expect(result).not.instanceOf(OpsInvalid);
      expect(result).not.instanceOf(OpsVerifyFailed);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("digestSRI verification failed"),
      );
    });
  });
});
