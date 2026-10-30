import { LocalKeys } from "@originator-profile/cryptography";
import {
  IssuerAccreditation,
  JapaneseExistencePA,
  OriginatorProfileSet,
  ProfileAnnotationIssuerRegistration,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { signCp } from "@originator-profile/sign";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from "vitest";
import { cp, opId } from "../helper";
import { OpsInvalid, OpsVerifyFailed } from "./errors";
import { buildOpsFixture, signOptions } from "./helper";
import { OpsVerifier } from "./verify-ops";

describe("Profile Annotation Issuer 認定証チェック", async () => {
  const { authority, certifier, certifierCp, authorityOp, certifierOp, ops } =
    await buildOpsFixture();

  let warnSpy: MockInstance;
  let infoSpy: MockInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  /** 認可判定に用いる Profile Annotation Policy ID */
  const POLICY_ID = "urn:uuid:70ca5f83-db7f-4440-bc7b-714996eaea8b";
  const OTHER_POLICY_ID = "urn:uuid:dbefee1f-db36-47a9-852f-afefd6a0287e";
  const ACCREDITATION_POLICY_ID =
    "urn:uuid:d1c6f93a-468f-4cef-a710-a1b665960fd2";

  const keys = LocalKeys({ keys: [authority.publicKey] });

  const existencePA: JapaneseExistencePA = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja-JP",
      },
    ],
    type: ["VerifiableCredential", "ProfileAnnotation"],
    issuer: opId.certifier,
    credentialSubject: {
      id: opId.originator,
      type: "JP-OrganizationExistenceCertificate",
      corporateName: "○○新聞社",
      corporateNumber: "0000000000000",
      postalCode: "000-0000",
      addressCountry: "JP",
      addressRegion: "東京都",
      addressLocality: "千代田区",
      streetAddress: "○○○",
      annotation: {
        id: POLICY_ID,
        type: "ProfileAnnotationPolicy",
        name: "架空組織実在性検証局",
        ref: "https://ovac.exp.originator-profile.org/",
      },
    },
  };

  const buildAccreditation = (schemes: string[]): IssuerAccreditation => ({
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      {
        "@language": "ja-JP",
      },
    ],
    type: ["VerifiableCredential", "ProfileAnnotation"],
    issuer: opId.authority,
    credentialSubject: {
      id: opId.certifier,
      type: "IssuerAccreditation",
      annotationIssuerName: "テスト Profile Annotation Issuer",
      annotationScheme: schemes,
      annotation: {
        id: ACCREDITATION_POLICY_ID,
        type: "ProfileAnnotationPolicy",
        name: "OP レジストリ Profile Annotation Issuer 認定制度",
      },
    },
  });

  /** 旧 type `ProfileAnnotationIssuerRegistration` の PA */
  const buildLegacyRegistration = (
    schemes: string[],
  ): ProfileAnnotationIssuerRegistration => {
    const accreditation = buildAccreditation(schemes);
    return {
      ...accreditation,
      credentialSubject: {
        ...accreditation.credentialSubject,
        type: "ProfileAnnotationIssuerRegistration",
      },
    };
  };

  const buildSelfAccreditation = (schemes: string[]): IssuerAccreditation => {
    const accreditation = buildAccreditation(schemes);
    accreditation.credentialSubject.id = opId.authority;
    return accreditation;
  };

  const originatorOpWithPa = async () => ({
    core: await signCp(cp, authority.privateKey, signOptions),
    annotations: [
      await signJwtVc(existencePA, certifier.privateKey, signOptions),
    ],
  });

  const certifierOpWithAccreditation = async (
    accreditation: IssuerAccreditation | ProfileAnnotationIssuerRegistration,
    signer = authority.privateKey,
  ) => ({
    core: await signCp(certifierCp, authority.privateKey, signOptions),
    annotations: [await signJwtVc(accreditation, signer, signOptions)],
  });

  const NOT_REGISTERED = "Profile Annotation Issuer is not registered";

  test("認定のない PA は console.info で通知", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
      expect.anything(),
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
      expect.anything(),
    );
  });

  test("認定証に含まれる PA は何もしない", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithAccreditation(buildAccreditation([POLICY_ID])),
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("OP[2]"),
      expect.anything(),
    );
  });

  test("旧 type ProfileAnnotationIssuerRegistration も認定証として扱う", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithAccreditation(buildLegacyRegistration([POLICY_ID])),
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("OP[2]"),
      expect.anything(),
    );
  });

  test("annotationScheme を持たない IssuerAccreditation は認可に使わない", async () => {
    const { annotationScheme: _, ...credentialSubject } = buildAccreditation([
      POLICY_ID,
    ]).credentialSubject;
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithAccreditation({
        ...buildAccreditation([]),
        credentialSubject,
      } as IssuerAccreditation),
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("OP[2]"),
      expect.anything(),
    );
  });

  test("認定証に含まれない場合は通知される", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithAccreditation(buildAccreditation([OTHER_POLICY_ID])),
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
      expect.anything(),
    );
  });

  test("認定証 PA は非 CP issuer が発行しても免除されず通知される", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      // certifier 自身が発行した認定証 PA (issuer=certifier)。CP issuer の認可は無い
      // （検証鍵はこの OP 自身の Core Profile から解決されるため certifierOp は不要）
      await certifierOpWithAccreditation(
        { ...buildAccreditation([POLICY_ID]), issuer: opId.certifier },
        certifier.privateKey,
      ),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
      expect.anything(),
    );
  });

  test("認定証 PA は CP issuer 自身が発行しても免除されず通知される", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithAccreditation(buildAccreditation([POLICY_ID])),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
      expect.anything(),
    );
  });

  test("複数の認定証は発行者ごとに annotationScheme の和集合をとる", async () => {
    const certifierWithTwoAccreditations = {
      core: await signCp(certifierCp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(
          buildAccreditation([OTHER_POLICY_ID]),
          authority.privateKey,
          signOptions,
        ),
        await signJwtVc(
          buildAccreditation([POLICY_ID]),
          authority.privateKey,
          signOptions,
        ),
      ],
    };

    const target: OriginatorProfileSet = [
      authorityOp,
      certifierWithTwoAccreditations,
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    const notRegisteredInfos = infoSpy.mock.calls.filter(
      ([message]) =>
        typeof message === "string" && message.includes(NOT_REGISTERED),
    );
    expect(notRegisteredInfos).toHaveLength(2);
    expect(notRegisteredInfos.some(([m]) => m.includes("OP[2]"))).toBe(false);
  });

  test("非推奨 Certificate は認可ゲートの対象外", async () => {
    const result = await OpsVerifier(ops, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
      expect.anything(),
    );
  });

  test("OP レジストリが認可した発行者は認定証 PA 発行可能", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithAccreditation(
        buildAccreditation([ACCREDITATION_POLICY_ID]),
      ),
      await certifierOpWithAccreditation(
        {
          ...buildAccreditation([]),
          issuer: opId.certifier,
        },
        certifier.privateKey,
      ),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("OP[1]"),
      expect.anything(),
    );
    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("OP[2]"),
      expect.anything(),
    );
  });

  test("認可の連鎖は再帰しない: CP→certifier 認可済みでも certifier 発行認定証は下流 PA を認可しない", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      // ① CP issuer が certifier に認定制度を認可（certifier は認定証 PA を発行可能になる）
      await certifierOpWithAccreditation(
        buildAccreditation([ACCREDITATION_POLICY_ID]),
      ),
      // ② certifier 自身が POLICY_ID を付与する認定証 PA を発行（issuer=certifier）
      await certifierOpWithAccreditation(
        { ...buildAccreditation([POLICY_ID]), issuer: opId.certifier },
        certifier.privateKey,
      ),
      // ③ certifier 発行の通常 PA（policy=POLICY_ID）を originator が保有
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);

    const notRegisteredInfos = infoSpy.mock.calls.filter(
      ([message]) =>
        typeof message === "string" && message.includes(NOT_REGISTERED),
    );
    expect(notRegisteredInfos).toHaveLength(2);
    expect(notRegisteredInfos[0]?.[0]).toContain("OP[1]");
    expect(notRegisteredInfos[1]?.[0]).toContain("OP[3]");
  });

  test("logger を指定した場合、console の代わりに通知を受け取る", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      await originatorOpWithPa(),
    ];

    const infos: string[] = [];
    const result = await OpsVerifier(target, keys, opId.authority, {
      logger: { warn: () => {}, info: (message) => infos.push(message) },
    })();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infos).toEqual(
      expect.arrayContaining([expect.stringContaining(NOT_REGISTERED)]),
    );
    expect(infoSpy).not.toHaveBeenCalled();
  });

  test("Core Profile Issuer が自己宛に認定制度スキームで発行した認定証が基底となる", async () => {
    const target: OriginatorProfileSet = [
      {
        ...authorityOp,
        annotations: [
          await signJwtVc(
            buildSelfAccreditation([ACCREDITATION_POLICY_ID]),
            authority.privateKey,
            signOptions,
          ),
        ],
      },
      await certifierOpWithAccreditation(buildAccreditation([POLICY_ID])),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
      expect.anything(),
    );
  });
});
