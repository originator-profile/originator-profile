import { LocalKeys } from "@originator-profile/cryptography";
import {
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

describe("Profile Annotation Issuer 登録証チェック", async () => {
  const { authority, certifier, certifierCp, authorityOp, certifierOp, ops } =
    await buildOpsFixture();

  let warnSpy: MockInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  /** 認可判定に用いる Profile Annotation Policy ID */
  const POLICY_ID = "urn:uuid:70ca5f83-db7f-4440-bc7b-714996eaea8b";
  const OTHER_POLICY_ID = "urn:uuid:dbefee1f-db36-47a9-852f-afefd6a0287e";
  const REGISTRATION_POLICY_ID =
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

  const buildRegistration = (
    schemes: string[],
  ): ProfileAnnotationIssuerRegistration => ({
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
      type: "ProfileAnnotationIssuerRegistration",
      annotationIssuerName: "テスト Profile Annotation Issuer",
      annotationScheme: schemes,
      annotation: {
        id: REGISTRATION_POLICY_ID,
        type: "ProfileAnnotationPolicy",
        name: "OP レジストリ Profile Annotation Issuer 登録制度",
      },
    },
  });

  const buildSelfRegistration = (
    schemes: string[],
  ): ProfileAnnotationIssuerRegistration => {
    const registration = buildRegistration(schemes);
    registration.credentialSubject.id = opId.authority;
    return registration;
  };

  const originatorOpWithPa = async () => ({
    core: await signCp(cp, authority.privateKey, signOptions),
    annotations: [
      await signJwtVc(existencePA, certifier.privateKey, signOptions),
    ],
  });

  const certifierOpWithRegistration = async (
    registration: ProfileAnnotationIssuerRegistration,
    signer = authority.privateKey,
  ) => ({
    core: await signCp(certifierCp, authority.privateKey, signOptions),
    annotations: [await signJwtVc(registration, signer, signOptions)],
  });

  const NOT_REGISTERED = "Profile Annotation Issuer is not registered";

  test("登録のない PA は console.warn で警告される (2027年まで)", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("登録証に含まれる PA は警告されない", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithRegistration(buildRegistration([POLICY_ID])),
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("登録証に含まれない場合は警告される", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithRegistration(buildRegistration([OTHER_POLICY_ID])),
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("非 CP issuer の登録証 PA は免除されず警告される", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      // certifier 自身が発行した登録証 PA (issuer=certifier)。CP issuer の認可は無い
      // （検証鍵はこの OP 自身の Core Profile から解決されるため certifierOp は不要）
      await certifierOpWithRegistration(
        { ...buildRegistration([POLICY_ID]), issuer: opId.certifier },
        certifier.privateKey,
      ),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    // isProfileAnnotationIssuerRegistration だが issuer が CP issuer でないため
    // 免除を受けず認可チェックに落ち、警告される
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("複数の登録証は発行者ごとに annotationScheme の和集合をとる", async () => {
    const certifierWithTwoRegistrations = {
      core: await signCp(certifierCp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(
          buildRegistration([OTHER_POLICY_ID]),
          authority.privateKey,
          signOptions,
        ),
        await signJwtVc(
          buildRegistration([POLICY_ID]),
          authority.privateKey,
          signOptions,
        ),
      ],
    };

    const target: OriginatorProfileSet = [
      authorityOp,
      certifierWithTwoRegistrations,
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("非推奨 Certificate は認可ゲートの対象外", async () => {
    const result = await OpsVerifier(ops, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("OP レジストリが認可した発行者は登録証 PA 発行可能", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithRegistration(
        buildRegistration([REGISTRATION_POLICY_ID]),
      ),
      await certifierOpWithRegistration(
        {
          ...buildRegistration([]),
          issuer: opId.certifier,
        },
        certifier.privateKey,
      ),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("認可の連鎖は再帰しない: CP→certifier 認可済みでも certifier 発行登録証は下流 PA を認可しない", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      // ① CP issuer が certifier に登録制度を認可（certifier は登録証 PA を発行可能になる）
      await certifierOpWithRegistration(
        buildRegistration([REGISTRATION_POLICY_ID]),
      ),
      // ② certifier 自身が POLICY_ID を付与する登録証 PA を発行（issuer=certifier）
      await certifierOpWithRegistration(
        { ...buildRegistration([POLICY_ID]), issuer: opId.certifier },
        certifier.privateKey,
      ),
      // ③ certifier 発行の通常 PA（policy=POLICY_ID）を originator が保有
      await originatorOpWithPa(),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);

    // ①②の登録証 PA は警告されず、③の通常 PA「のみ」警告される（連鎖は伝播しない）
    const notRegisteredWarnings = warnSpy.mock.calls.filter(
      ([message]) =>
        typeof message === "string" && message.includes(NOT_REGISTERED),
    );
    expect(notRegisteredWarnings).toHaveLength(1);
    expect(notRegisteredWarnings[0]?.[0]).toContain("OP[3]");
  });

  test("Core Profile Issuer が発行した登録証 PA は基底となる", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      await certifierOpWithRegistration(buildRegistration([POLICY_ID])),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });

  test("warn ハンドラーを指定した場合、console.warn の代わりに警告を受け取る", async () => {
    const target: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      await originatorOpWithPa(),
    ];

    const warnings: string[] = [];
    const result = await OpsVerifier(target, keys, opId.authority, {
      warn: (message) => warnings.push(message),
    })();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining(NOT_REGISTERED)]),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("Core Profile Issuer が自己宛に発行した登録証は基底となる", async () => {
    const target: OriginatorProfileSet = [
      {
        ...authorityOp,
        annotations: [
          await signJwtVc(
            buildSelfRegistration([OTHER_POLICY_ID]),
            authority.privateKey,
            signOptions,
          ),
        ],
      },
      await certifierOpWithRegistration(buildRegistration([POLICY_ID])),
    ];

    const result = await OpsVerifier(target, keys, opId.authority)();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(NOT_REGISTERED),
    );
  });
});
