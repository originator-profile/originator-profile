import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import { CoreProfile, OriginatorProfileSet } from "@originator-profile/model";
import {
  signJwtVc,
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
} from "../helper";
import {
  CoreProfileNotFound,
  OpInvalid,
  OpsInvalid,
  OpsVerifyFailed,
  OpVerifyFailed,
} from "./errors";
import { OpsVerifier } from "./verify-ops";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
const signOptions = { issuedAt, expiredAt };
const verifyResult = VerifyResultFactory(issuedAt, expiredAt);

describe("OPSの検証", async () => {
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

  test("OPSの検証に成功", async () => {
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
  });

  test("CPの署名の検証に失敗", async () => {
    const evil = await generateKey();
    const evilCp = await signCp(cp, evil.privateKey, signOptions);
    const evilOps: OriginatorProfileSet = patch(ops, [
      {
        op: "replace",
        path: [2, "core"],
        value: evilCp,
      },
    ]);
    const verify = OpsVerifier(
      evilOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).instanceOf(OpsVerifyFailed);
    // @ts-expect-error verify failed Ops
    const { result: resultOp } = resultOps;
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

  test("PAの署名の検証に失敗", async () => {
    const evil = await generateKey();
    const evilPa = await signJwtVc(certificate, evil.privateKey, signOptions);
    const evilOps: OriginatorProfileSet = patch(ops, [
      {
        op: "add",
        path: [2, "annotations", 1],
        value: evilPa,
      },
    ]);
    const verify = OpsVerifier(
      evilOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).instanceOf(OpsVerifyFailed);
    // @ts-expect-error verify failed Ops
    const { result: resultOp } = resultOps;
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
    expect(resultOp[2].result.core).toStrictEqual(
      verifyResult.create(cp, originatorOp.core, authority.publicKey),
    );
    expect(resultOp[2].result.annotations[0]).toStrictEqual(
      verifyResult.create(
        certificate,
        originatorOp.annotations[0],
        certifier.publicKey,
      ),
    );
    expect(resultOp[2].result.annotations[1]).instanceOf(VcVerifyFailed);
    expect(resultOp[2].result.media).toStrictEqual([
      verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
    ]);
  });

  test("WMPの署名の検証に失敗", async () => {
    const evil = await generateKey();
    const evilWmp = await signJwtVc(wmp, evil.privateKey, signOptions);
    const evilOps: OriginatorProfileSet = patch(ops, [
      {
        op: "replace",
        path: [2, "media"],
        value: [evilWmp],
      },
    ]);
    const verify = OpsVerifier(
      evilOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).instanceOf(OpsVerifyFailed);
    // @ts-expect-error verify failed Ops
    const { result: resultOp } = resultOps;
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
    expect(resultOp[2].result.core).toStrictEqual(
      verifyResult.create(cp, originatorOp.core, authority.publicKey),
    );
    expect(resultOp[2].result.annotations[0]).toStrictEqual(
      verifyResult.create(
        certificate,
        originatorOp.annotations[0],
        certifier.publicKey,
      ),
    );
    expect(resultOp[2].result.media[0]).instanceOf(VcVerifyFailed);
  });

  test("CPの発行者と署名者が不一致", async () => {
    const evilCp = await signCp(
      patch(cp, [{ op: "replace", path: ["issuer"], value: opId.invalid }]),
      authority.privateKey,
      signOptions,
    );
    const evilOps: OriginatorProfileSet = patch(ops, [
      {
        op: "replace",
        path: [2, "core"],
        value: evilCp,
      },
    ]);
    const verify = OpsVerifier(
      evilOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).instanceOf(OpsVerifyFailed);
    // @ts-expect-error verify failed Ops
    const { result: resultOp } = resultOps;
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

  test("CPとWMPの保有者が不一致", async () => {
    const invalidWmp = await signJwtVc(
      patch(wmp, [
        {
          op: "replace",
          path: ["credentialSubject", "id"],
          value: opId.invalid,
        },
      ]),
      authority.privateKey,
      signOptions,
    );
    const invalidOps = patch(ops, [
      {
        op: "replace",
        path: [2, "media"],
        value: [invalidWmp],
      },
    ]);
    const verify = OpsVerifier(
      invalidOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[0]).toStrictEqual({
      core: verifyResult.create(authorityCp, authorityOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).toStrictEqual({
      core: verifyResult.create(certifierCp, certifierOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[2]).instanceOf(OpInvalid);
  });

  test("CPとPAの保有者が不一致", async () => {
    const invalidPa = await signJwtVc(
      patch(certificate, [
        {
          op: "replace",
          path: ["credentialSubject", "id"],
          value: opId.invalid,
        },
      ]),
      authority.privateKey,
      signOptions,
    );
    const evilOps: OriginatorProfileSet = patch(ops, [
      {
        op: "add",
        path: [2, "annotations", 1],
        value: invalidPa,
      },
    ]);
    const verify = OpsVerifier(
      evilOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[0]).toStrictEqual({
      core: verifyResult.create(authorityCp, authorityOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).toStrictEqual({
      core: verifyResult.create(certifierCp, certifierOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[2]).instanceOf(OpInvalid);
  });

  test("CP発行者のOPがOPSに存在しなくても検証に成功", async () => {
    const verify = OpsVerifier(
      [certifierOp],
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).not.instanceOf(OpsVerifyFailed);
    expect(resultOps).toStrictEqual([
      {
        core: verifyResult.create(
          certifierCp,
          certifierOp.core,
          authority.publicKey,
        ),
        annotations: undefined,
        media: undefined,
      },
    ]);
  });

  test("PA発行者のOPがOPSに存在しない", async () => {
    const invalidOps: OriginatorProfileSet = [authorityOp, originatorOp];
    const verify = OpsVerifier(
      invalidOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).instanceOf(OpsVerifyFailed);
    // @ts-expect-error verify failed Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[0]).toStrictEqual({
      core: verifyResult.create(
        authorityCp,
        authorityOp.core,
        authority.publicKey,
      ),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).instanceOf(OpVerifyFailed);
    expect(resultOp[1].result.core).toStrictEqual(
      verifyResult.create(cp, originatorOp.core, authority.publicKey),
    );
    expect(resultOp[1].result.annotations[0]).instanceOf(CoreProfileNotFound);
    expect(resultOp[1].result.media).toStrictEqual([
      verifyResult.create(wmp, originatorOp.media[0], authority.publicKey),
    ]);
  });

  test("WMP発行者のOPがOPSに存在しない", async () => {
    const invalidOps: OriginatorProfileSet = [certifierOp, originatorOp];
    const verify = OpsVerifier(
      invalidOps,
      LocalKeys({ keys: [authority.publicKey] }),
      opId.authority,
    );
    const resultOps = await verify();

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).instanceOf(OpsVerifyFailed);
    // @ts-expect-error verify failed Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[0]).toStrictEqual({
      core: verifyResult.create(
        certifierCp,
        certifierOp.core,
        authority.publicKey,
      ),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).instanceOf(OpVerifyFailed);
    expect(resultOp[1].result.core).toStrictEqual(
      verifyResult.create(cp, originatorOp.core, authority.publicKey),
    );
    expect(resultOp[1].result.annotations[0]).toStrictEqual(
      verifyResult.create(
        certificate,
        originatorOp.annotations[0],
        certifier.publicKey,
      ),
    );
    expect(resultOp[1].result.media[0]).instanceOf(CoreProfileNotFound);
  });

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
});
