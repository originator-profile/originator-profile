import { generateKey } from "@originator-profile/cryptography";
import {
  Certificate,
  CoreProfile,
  OpVc,
  OriginatorProfileSet,
  WebMediaProfile,
} from "@originator-profile/model";
import {
  signJwtVc,
  UnverifiedJwtVc,
  VcDecodeFailed,
} from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import { addYears, fromUnixTime, getUnixTime } from "date-fns";
import { diffApply } from "just-diff-apply";
import { describe, expect, test } from "vitest";
import { decodeOps } from "./decode-ops";
import { OpInvalid, OpsInvalid, OpsVerifyFailed } from "./errors";

const issuedAt = fromUnixTime(getUnixTime(new Date()));
const expiredAt = addYears(issuedAt, 10);
const signOptions = { issuedAt, expiredAt };
const toDecodeResult = (vc: OpVc, jwt: string): UnverifiedJwtVc<OpVc> => ({
  doc: vc,
  issuedAt,
  expiredAt,
  algorithm: "ES256",
  mediaType: "application/vc+jwt",
  source: jwt,
});
const patch = <T extends object>(...args: Parameters<typeof diffApply<T>>) => {
  const [source, diff] = args;
  const patched = structuredClone(source);
  diffApply(patched, diff);
  return patched;
};
const opId = {
  authority: "dns:cp-issuer.example.org" as const,
  certifier: "dns:pa-issuer.example.org" as const,
  holder: "dns:op-holder.example.org" as const,
};
const cp: CoreProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
  ],
  type: ["VerifiableCredential", "CoreProfile"],
  issuer: opId.authority,
  credentialSubject: {
    id: opId.holder,
    type: "Core",
    jwks: {
      keys: [],
    },
  },
};
const certificate: Certificate = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "Certificate"],
  issuer: opId.certifier,
  credentialSubject: {
    id: opId.holder,
    type: "CertificateProperties",
    description: "Example Certificate",
    certificationSystem: {
      id: "urn:uuid:de5d6e80-10a5-404f-b4d3-e9f0e6926a21",
      type: "CertificationSystem",
      name: "Example Certification System",
      description: "Example Certification System Description",
    },
  },
};
const wmp: WebMediaProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "WebMediaProfile"],
  issuer: opId.authority,
  credentialSubject: {
    id: opId.holder,
    type: "OnlineBusiness",
    name: "Example OP Holder",
    url: "https://op-holder.example.org/",
  },
};

describe("OPSの復号", async () => {
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
  const holderOp = {
    core: await signCp(cp, authority.privateKey, signOptions),
    annotations: [
      await signJwtVc(certificate, certifier.privateKey, signOptions),
    ],
    media: [await signJwtVc(wmp, authority.privateKey, signOptions)],
  };
  const ops: OriginatorProfileSet = [authorityOp, certifierOp, holderOp];

  test("OPSの復号に成功", () => {
    const resultOps = decodeOps(ops);

    expect(resultOps).not.instanceOf(OpsInvalid);
    expect(resultOps).not.instanceOf(OpsVerifyFailed);
    expect(resultOps).toStrictEqual([
      {
        core: toDecodeResult(authorityCp, authorityOp.core),
        annotations: undefined,
        media: undefined,
      },
      {
        core: toDecodeResult(certifierCp, certifierOp.core),
        annotations: undefined,
        media: undefined,
      },
      {
        core: toDecodeResult(cp, holderOp.core),
        annotations: [toDecodeResult(certificate, holderOp.annotations[0])],
        media: [toDecodeResult(wmp, holderOp.media[0])],
      },
    ]);
  });

  test("CPの復号に失敗", () => {
    const invalidOps = patch(ops, [
      { op: "replace", path: [2, "core"], value: "invalid" },
    ]);
    const resultOps = decodeOps(invalidOps);

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[0]).toStrictEqual({
      core: toDecodeResult(authorityCp, authorityOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).toStrictEqual({
      core: toDecodeResult(certifierCp, certifierOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[2]).instanceOf(OpInvalid);
    expect(resultOp[2].message).toBe("Core Profile decode failed (OP[2])");
    expect(resultOp[2].result.core).instanceOf(VcDecodeFailed);
    expect(resultOp[2].result.annotations[0]).toStrictEqual(
      toDecodeResult(certificate, holderOp.annotations[0]),
    );
    expect(resultOp[2].result.media).toStrictEqual([
      toDecodeResult(wmp, holderOp.media[0]),
    ]);
  });

  test("PAの復号に失敗", () => {
    const invalidOps = patch(ops, [
      { op: "replace", path: [2, "annotations", 0], value: "invalid" },
    ]);
    const resultOps = decodeOps(invalidOps);

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[0]).toStrictEqual({
      core: toDecodeResult(authorityCp, authorityOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).toStrictEqual({
      core: toDecodeResult(certifierCp, certifierOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[2]).instanceOf(OpInvalid);
    expect(resultOp[2].message).toBe(
      "Profile Annotation decode failed (OP[2].PA[0])",
    );
    expect(resultOp[2].result.core).toStrictEqual(
      toDecodeResult(cp, holderOp.core),
    );
    expect(resultOp[2].result.annotations[0]).instanceOf(VcDecodeFailed);
    expect(resultOp[2].result.media).toStrictEqual([
      toDecodeResult(wmp, holderOp.media[0]),
    ]);
  });

  test("WMPの復号に失敗", () => {
    const invalidOps = patch(ops, [
      { op: "replace", path: [2, "media"], value: "invalid" },
    ]);
    const resultOps = decodeOps(invalidOps);

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[0]).toStrictEqual({
      core: toDecodeResult(authorityCp, authorityOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[1]).toStrictEqual({
      core: toDecodeResult(certifierCp, certifierOp.core),
      annotations: undefined,
      media: undefined,
    });
    expect(resultOp[2]).instanceOf(OpInvalid);
    expect(resultOp[2].message).toBe(
      "Web Media Profile decode failed (OP[2].WMP[0])",
    );
    expect(resultOp[2].result.core).toStrictEqual(
      toDecodeResult(cp, holderOp.core),
    );
    expect(resultOp[2].result.annotations[0]).toStrictEqual(
      toDecodeResult(certificate, holderOp.annotations[0]),
    );
    expect(resultOp[2].result.media[0]).instanceOf(VcDecodeFailed);
  });

  test("複数PAの復号に失敗", () => {
    const invalidOps = patch(ops, [
      { op: "replace", path: [2, "annotations", 0], value: "invalid" },
      { op: "add", path: [2, "annotations", 1], value: "invalid2" },
    ]);
    const resultOps = decodeOps(invalidOps);

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[2]).instanceOf(OpInvalid);
    expect(resultOp[2].message).toBe(
      "Profile Annotation decode failed (OP[2].PA[0], OP[2].PA[1])",
    );
  });

  test("CPとPAのsubjectが不一致", async () => {
    const mismatchPa = await signJwtVc(
      patch(certificate, [
        {
          op: "replace",
          path: ["credentialSubject", "id"],
          value: "dns:mismatch.example.org",
        },
      ]),
      certifier.privateKey,
      signOptions,
    );
    const invalidOps: OriginatorProfileSet = patch(ops, [
      { op: "replace", path: [2, "annotations", 0], value: mismatchPa },
    ]);
    const resultOps = decodeOps(invalidOps);

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[2]).instanceOf(OpInvalid);
    expect(resultOp[2].message).toBe(
      `Subject mismatch between Core Profile and Profile Annotation (OP[2].PA[0] issuer: ${opId.certifier}, subject: dns:mismatch.example.org)`,
    );
  });

  test("CPとWMPのsubjectが不一致", async () => {
    const mismatchWmp = await signJwtVc(
      patch(wmp, [
        {
          op: "replace",
          path: ["credentialSubject", "id"],
          value: "dns:mismatch.example.org",
        },
      ]),
      authority.privateKey,
      signOptions,
    );
    const invalidOps: OriginatorProfileSet = patch(ops, [
      { op: "replace", path: [2, "media"], value: [mismatchWmp] },
    ]);
    const resultOps = decodeOps(invalidOps);

    expect(resultOps).instanceOf(OpsInvalid);
    // @ts-expect-error invalid Ops
    const { result: resultOp } = resultOps;
    expect(resultOp[2]).instanceOf(OpInvalid);
    expect(resultOp[2].message).toBe(
      `Subject mismatch between Core Profile and Web Media Profile (OP[2].WMP[0] issuer: ${opId.authority}, subject: dns:mismatch.example.org)`,
    );
  });
});
