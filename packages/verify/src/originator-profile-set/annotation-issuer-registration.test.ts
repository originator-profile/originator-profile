import { LocalKeys } from "@originator-profile/cryptography";
import {
  JapaneseExistencePA,
  OriginatorProfileSet,
  ProfileAnnotationIssuerRegistration,
} from "@originator-profile/model";
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
import { cp, opId } from "../helper";
import { OpsInvalid, OpsVerifyFailed } from "./errors";
import { buildOpsFixture, opsVerifierOptions, signOptions } from "./helper";
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

  const POLICY_ID = "urn:uuid:def09cbd-6e8e-4c73-856d-5e00dffde643";
  const OTHER_POLICY_ID = "urn:uuid:8029ece0-b327-4a7e-b586-3e442cb82d92";
  const REGISTRATION_POLICY_ID =
    "urn:uuid:5927e1da-e422-47c8-a5b8-efa6f5a45dd7";

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
        name: "法人番号システムWeb-API",
        ref: "https://www.houjin-bangou.nta.go.jp/",
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

  test("登録のない PA は console.warn で警告される", async () => {
    const opsWithUnregisteredPa: OriginatorProfileSet = [
      authorityOp,
      certifierOp,
      {
        core: await signCp(cp, authority.privateKey, signOptions),
        annotations: [
          await signJwtVc(existencePA, certifier.privateKey, signOptions),
        ],
      },
    ];

    const result = await OpsVerifier(
      opsWithUnregisteredPa,
      opsVerifierOptions(
        opId.authority,
        LocalKeys({ keys: [authority.publicKey] }),
      ),
    )();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Profile Annotation Issuer is not registered"),
    );
  });

  test("登録された PA は warn されない", async () => {
    const registration = buildRegistration([POLICY_ID]);
    const certifierWithRegistration = {
      core: await signCp(certifierCp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(registration, authority.privateKey, signOptions),
      ],
    };

    const opsWithRegisteredPa: OriginatorProfileSet = [
      authorityOp,
      certifierWithRegistration,
      {
        core: await signCp(cp, authority.privateKey, signOptions),
        annotations: [
          await signJwtVc(existencePA, certifier.privateKey, signOptions),
        ],
      },
    ];

    const result = await OpsVerifier(
      opsWithRegisteredPa,
      opsVerifierOptions(
        opId.authority,
        LocalKeys({ keys: [authority.publicKey] }),
      ),
    )();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Profile Annotation Issuer is not registered"),
    );
  });

  test("登録に該当する scheme が含まれない場合は warn される", async () => {
    const registration = buildRegistration([OTHER_POLICY_ID]);
    const certifierWithRegistration = {
      core: await signCp(certifierCp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(registration, authority.privateKey, signOptions),
      ],
    };

    const opsWithUnauthorizedScheme: OriginatorProfileSet = [
      authorityOp,
      certifierWithRegistration,
      {
        core: await signCp(cp, authority.privateKey, signOptions),
        annotations: [
          await signJwtVc(existencePA, certifier.privateKey, signOptions),
        ],
      },
    ];

    const result = await OpsVerifier(
      opsWithUnauthorizedScheme,
      opsVerifierOptions(
        opId.authority,
        LocalKeys({ keys: [authority.publicKey] }),
      ),
    )();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Profile Annotation Issuer is not registered"),
    );
  });

  test("登録証 PA 自身に対しては warn しない", async () => {
    const registration = buildRegistration([POLICY_ID]);
    const certifierWithRegistration = {
      core: await signCp(certifierCp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(registration, authority.privateKey, signOptions),
      ],
    };

    const opsRegistrationOnly: OriginatorProfileSet = [
      authorityOp,
      certifierWithRegistration,
    ];

    const result = await OpsVerifier(
      opsRegistrationOnly,
      opsVerifierOptions(
        opId.authority,
        LocalKeys({ keys: [authority.publicKey] }),
      ),
    )();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Profile Annotation Issuer is not registered"),
    );
  });

  test("Legacy Certificate (type が ProfileAnnotation でない) は warn 対象外", async () => {
    const result = await OpsVerifier(
      ops,
      opsVerifierOptions(
        opId.authority,
        LocalKeys({ keys: [authority.publicKey] }),
      ),
    )();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Profile Annotation Issuer is not registered"),
    );
  });

  test("REGISTRY_OPS の issuer 以外が発行した登録証は採用されず warn される", async () => {
    const registration: ProfileAnnotationIssuerRegistration = {
      ...buildRegistration([POLICY_ID]),
      issuer: opId.certifier,
    };
    const certifierWithRegistration = {
      core: await signCp(certifierCp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(registration, certifier.privateKey, signOptions),
      ],
    };

    const opsWithForeignRegistration: OriginatorProfileSet = [
      authorityOp,
      certifierWithRegistration,
      {
        core: await signCp(cp, authority.privateKey, signOptions),
        annotations: [
          await signJwtVc(existencePA, certifier.privateKey, signOptions),
        ],
      },
    ];

    const result = await OpsVerifier(
      opsWithForeignRegistration,
      opsVerifierOptions(
        opId.authority,
        LocalKeys({ keys: [authority.publicKey] }),
      ),
    )();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Profile Annotation Issuer Registration is not issued by REGISTRY_OPS",
      ),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Profile Annotation Issuer is not registered"),
    );
  });

  test("REGISTRY_OPS の issuer を配列で複数指定でき、いずれかと一致すれば採用される", async () => {
    const registration = buildRegistration([POLICY_ID]);
    const certifierWithRegistration = {
      core: await signCp(certifierCp, authority.privateKey, signOptions),
      annotations: [
        await signJwtVc(registration, authority.privateKey, signOptions),
      ],
    };

    const opsWithRegisteredPa: OriginatorProfileSet = [
      authorityOp,
      certifierWithRegistration,
      {
        core: await signCp(cp, authority.privateKey, signOptions),
        annotations: [
          await signJwtVc(existencePA, certifier.privateKey, signOptions),
        ],
      },
    ];

    const result = await OpsVerifier(
      opsWithRegisteredPa,
      opsVerifierOptions(
        ["dns:other-registry.example.org", opId.authority],
        LocalKeys({ keys: [authority.publicKey] }),
      ),
    )();

    expect(result).not.instanceOf(OpsInvalid);
    expect(result).not.instanceOf(OpsVerifyFailed);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Profile Annotation Issuer is not registered"),
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "Profile Annotation Issuer Registration is not issued by REGISTRY_OPS",
      ),
    );
  });
});
