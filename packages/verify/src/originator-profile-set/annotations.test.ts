import { LocalKeys } from "@originator-profile/cryptography";
import { Certificate, OriginatorProfileSet } from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
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
import { OpsInvalid, OpsVerifyFailed } from "./errors";
import { buildOpsFixture, signOptions, verifyResult } from "./helper";
import type { VerifiedOps } from "./types";
import { OpsVerifier } from "./verify-ops";

describe("Profile Annotation の検証", async () => {
  const {
    authority,
    certifier,
    authorityCp,
    certifierCp,
    authorityOp,
    certifierOp,
  } = await buildOpsFixture();

  test("有効期間内のcertificateがあるOPSの検証に成功", async () => {
    const certificateWithExpiry: Certificate = structuredClone(certificate);
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const until = new Date();
    until.setDate(until.getDate() + 1);
    certificateWithExpiry.validFrom = from.toISOString();
    certificateWithExpiry.validUntil = until.toISOString();

    const originatorOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(
          certificateWithExpiry,
          certifier.privateKey,
          signOptions,
        ),
      ],
      media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
    };

    const ops: OriginatorProfileSet = [authorityOp, certifierOp, originatorOp];
    const verify = OpsVerifier(
      ops,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).not.instanceOf(OpsVerifyFailed);
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
        core: verifyResult.create(cp, originatorOp.core, authority.publicKey),
        annotations: [
          verifyResult.create(
            certificateWithExpiry,
            originatorOp.annotations[0],
            certifier.publicKey,
          ),
        ],
        media: [
          verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
        ],
      },
    ]);
  });

  test("validFromのみ設定され有効期間内のcertificateがあるOPSの検証に成功", async () => {
    const certificateWithExpiry: Certificate = structuredClone(certificate);
    const from = new Date();
    from.setDate(from.getDate() - 1);
    certificateWithExpiry.validFrom = from.toISOString();

    const originatorOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(
          certificateWithExpiry,
          certifier.privateKey,
          signOptions,
        ),
      ],
      media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
    };

    const ops: OriginatorProfileSet = [authorityOp, certifierOp, originatorOp];
    const verify = OpsVerifier(
      ops,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).not.instanceOf(OpsVerifyFailed);

    const verifiedOps = resultOps as VerifiedOps;
    expect(verifiedOps[2]).toStrictEqual({
      core: verifyResult.create(cp, originatorOp.core, authority.publicKey),
      annotations: [
        verifyResult.create(
          certificateWithExpiry,
          originatorOp.annotations[0],
          certifier.publicKey,
        ),
      ],
      media: [
        verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
      ],
    });
  });

  test("validUntilのみ設定され有効期間内のcertificateがあるOPSの検証に成功", async () => {
    const certificateWithExpiry: Certificate = structuredClone(certificate);
    const until = new Date();
    until.setDate(until.getDate() + 1);
    certificateWithExpiry.validUntil = until.toISOString();

    const originatorOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(
          certificateWithExpiry,
          certifier.privateKey,
          signOptions,
        ),
      ],
      media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
    };

    const ops: OriginatorProfileSet = [authorityOp, certifierOp, originatorOp];
    const verify = OpsVerifier(
      ops,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).not.instanceOf(OpsVerifyFailed);

    const verifiedOps = resultOps as VerifiedOps;
    expect(verifiedOps[2]).toStrictEqual({
      core: verifyResult.create(cp, originatorOp.core, authority.publicKey),
      annotations: [
        verifyResult.create(
          certificateWithExpiry,
          originatorOp.annotations[0],
          certifier.publicKey,
        ),
      ],
      media: [
        verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
      ],
    });
  });

  test("validFromが現在時刻と完全に一致する境界値でcertificateが有効と判定される", async () => {
    const fixedTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);

    try {
      const certificateWithExpiry: Certificate = structuredClone(certificate);
      certificateWithExpiry.validFrom = fixedTime.toISOString();

      const originatorOp = {
        core: await signCp(cp, authority.privateKey, signOptions),
        annotations: [
          await signJwtVc(
            certificateWithExpiry,
            certifier.privateKey,
            signOptions,
          ),
        ],
        media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
      };

      const ops: OriginatorProfileSet = [
        authorityOp,
        certifierOp,
        originatorOp,
      ];
      const verify = OpsVerifier(
        ops,
        LocalKeys({ keys: [authority.publicKey] }),
        opId.authority,
      );
      const resultOps = await verify();

      expect(resultOps).not.instanceOf(OpsInvalid);
      expect(resultOps).not.instanceOf(OpsVerifyFailed);

      const verifiedOps = resultOps as VerifiedOps;
      expect(verifiedOps[2]).toStrictEqual({
        core: verifyResult.create(cp, originatorOp.core, authority.publicKey),
        annotations: [
          verifyResult.create(
            certificateWithExpiry,
            originatorOp.annotations[0],
            certifier.publicKey,
          ),
        ],
        media: [
          verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
        ],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("validUntilが現在時刻と完全に一致する境界値でcertificateが有効と判定される", async () => {
    const fixedTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);

    try {
      const certificateWithExpiry: Certificate = structuredClone(certificate);
      certificateWithExpiry.validUntil = fixedTime.toISOString();

      const originatorOp = {
        core: await signCp(cp, authority.privateKey, signOptions),
        annotations: [
          await signJwtVc(
            certificateWithExpiry,
            certifier.privateKey,
            signOptions,
          ),
        ],
        media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
      };

      const ops: OriginatorProfileSet = [
        authorityOp,
        certifierOp,
        originatorOp,
      ];
      const verify = OpsVerifier(
        ops,
        LocalKeys({ keys: [authority.publicKey] }),
        opId.authority,
      );
      const resultOps = await verify();

      expect(resultOps).not.instanceOf(OpsInvalid);
      expect(resultOps).not.instanceOf(OpsVerifyFailed);

      const verifiedOps = resultOps as VerifiedOps;
      expect(verifiedOps[2]).toStrictEqual({
        core: verifyResult.create(cp, originatorOp.core, authority.publicKey),
        annotations: [
          verifyResult.create(
            certificateWithExpiry,
            originatorOp.annotations[0],
            certifier.publicKey,
          ),
        ],
        media: [
          verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
        ],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("有効開始日時が未来のcertificateがあるOPSの検証でOpsVerifyFailedになるか", async () => {
    const certificateWithExpiry: Certificate = structuredClone(certificate);
    const from = new Date();
    from.setDate(from.getDate() + 2);
    certificateWithExpiry.validFrom = from.toISOString();

    const originatorOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(
          certificateWithExpiry,
          certifier.privateKey,
          signOptions,
        ),
      ],
      media: await signJwtVc(wmp, authority.privateKey, signOptions),
    };

    const ops: OriginatorProfileSet = [authorityOp, certifierOp, originatorOp];
    const verify = OpsVerifier(
      ops,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();
    expect(resultOps).instanceOf(OpsVerifyFailed);
  });

  test("有効終了日時が過去のcertificateがあるOPSの検証でOpsVerifyFailedになるか", async () => {
    const certificateWithExpiry: Certificate = structuredClone(certificate);
    const until = new Date();
    until.setDate(until.getDate() - 2);
    certificateWithExpiry.validUntil = until.toISOString();

    const originatorOp = {
      core: await signCp(cp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(
          certificateWithExpiry,
          certifier.privateKey,
          signOptions,
        ),
      ],
      media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
    };

    const ops: OriginatorProfileSet = [authorityOp, certifierOp, originatorOp];
    const verify = OpsVerifier(
      ops,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();
    expect(resultOps).instanceOf(OpsVerifyFailed);
  });

  describe("annotation image digestSRI検証 (2027年まではwarn扱い)", () => {
    let warnSpy: MockInstance;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test("digestSRIがない場合、warnが出るが検証は成功する", async () => {
      const certWithImage: Certificate = patch(certificate, [
        {
          op: "add",
          path: ["credentialSubject", "image"],
          value: { id: "https://example.org/cert-image.png" },
        },
      ]);

      const result = await OpsVerifier(
        [
          authorityOp,
          certifierOp,
          {
            core: await signCp(cp, authority.privateKey, signOptions),
            annotations: [
              await signJwtVc(certWithImage, certifier.privateKey, signOptions),
            ],
            media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
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
      const certWithBadImage: Certificate = patch(certificate, [
        {
          op: "add",
          path: ["credentialSubject", "image"],
          value: {
            id: "https://example.org/cert-image.png",
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
              await signJwtVc(
                certWithBadImage,
                certifier.privateKey,
                signOptions,
              ),
            ],
            media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
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
