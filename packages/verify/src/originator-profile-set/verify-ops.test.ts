import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import { OriginatorProfileSet } from "@originator-profile/model";
import {
  signJwtVc,
  VcVerifyFailed,
} from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import { describe, expect, test } from "vitest";
import { certificate, cp, opId, patch, wmp } from "../helper";
import {
  CoreProfileNotFound,
  OpInvalid,
  OpsInvalid,
  OpsVerifyFailed,
  OpVerifyFailed,
} from "./errors";
import { buildOpsFixture, signOptions, verifyResult } from "./helper";
import { OpsVerifier } from "./verify-ops";

describe("OPSの検証", async () => {
  const {
    authority,
    certifier,
    authorityCp,
    certifierCp,
    authorityOp,
    certifierOp,
    originatorOp,
    ops,
  } = await buildOpsFixture();

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
    expect(resultOp[2].message).toBe("Core Profile verify failed (OP[2])");
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
    expect(resultOp[2].message).toBe(
      `Profile Annotation verify failed (OP[2].PA[1] issuer: ${opId.certifier}, subject: ${opId.originator})`,
    );
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
    expect(resultOp[2].message).toBe(
      `Web Media Profile verify failed (OP[2].WMP[0] issuer: ${opId.authority}, subject: ${opId.originator})`,
    );
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
    expect(resultOp[2].message).toBe("Core Profile verify failed (OP[2])");
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
});
