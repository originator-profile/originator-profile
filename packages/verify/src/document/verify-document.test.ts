import { generateKey } from "@originator-profile/cryptography";
import type { OriginatorProfileSet } from "@originator-profile/model";
import { signCa } from "@originator-profile/sign";
import { assert, describe, expect, test } from "vitest";
import { CasVerifyFailed } from "../content-attestation-set";
import { article, opId } from "../helper";
import type { VerifyIntegrity } from "../integrity";
import {
  CoreProfileNotFound,
  OpsVerifier,
  OpsVerifyFailed,
} from "../originator-profile-set";
import { buildOpsFixture, signOptions } from "../originator-profile-set/helper";
import { prepareRegistry, verifyRegistry, type Registry } from "../registry";
import {
  convertOps,
  createCollector,
  type OriginatorPayload,
} from "../result/convert";
import { problemType } from "../result/problem-types";
import { toProblemDetails } from "../result/to-problem-details";
import {
  verifyDocument,
  type SharedOriginators,
  type VerificationTarget,
} from "./verify-document";

/** 検証中の通知を握りつぶす */
const silent = { warn: () => {}, info: () => {} };

/** CAS が空の文書、または発行者の Core Profile がない CA では呼ばれない */
const notCalled: VerifyIntegrity = () => {
  throw new Error("verifyIntegrity should not be called");
};

const subjectIds = (ops: OriginatorPayload[]) =>
  ops.flatMap((op) => op.core?.credentialSubject.id ?? []);

/** レジストリを検証して共有の発信者にする */
const sharedRegistry = async (
  registry: Registry,
): Promise<SharedOriginators> => ({
  registry: await verifyRegistry(registry, { logger: silent }),
});

/**
 * レジストリと Web サイトの発信者を検証して共有の発信者にする
 *
 * Web サイトの検証結果のうち、発信者の部分だけを模す。
 */
const sharedSite = async (
  registry: Registry,
  originators: OriginatorProfileSet,
): Promise<Required<SharedOriginators>> => {
  const verifiedRegistry = await verifyRegistry(registry, { logger: silent });
  const verified = await OpsVerifier(
    originators,
    registry.keys,
    registry.issuer,
    { logger: silent, trusted: verifiedRegistry.outcome?.originators },
  )();
  const collect = createCollector();
  const outcome = { originators: convertOps(verified, collect) };
  return {
    registry: verifiedRegistry,
    site:
      verified instanceof Error
        ? {
            status: false,
            outcome,
            securingResults: collect.securingResults,
            warnings: [],
            info: [],
            errors: [toProblemDetails(verified), ...collect.errors],
          }
        : {
            status: true,
            outcome,
            securingResults: collect.securingResults,
            warnings: [],
            info: [],
          },
  };
};

const target = (
  overrides: Partial<VerificationTarget> = {},
): VerificationTarget => ({
  ops: [],
  cas: [],
  url: "https://www.example.org/a",
  frameType: "outermost_frame",
  verifyIntegrity: notCalled,
  ...overrides,
});

describe("verifyDocument", () => {
  test("文書の OPS を、共有の発信者を検証鍵に加えて検証する", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;
    const input = target({ ops: [originatorOp], frameType: "sub_frame" });

    const result = await verifyDocument(input, {
      registry,
      shared: await sharedRegistry(registry),
      logger: silent,
    });

    expect(result.status).toBe(true);
    expect(result.outcome?.target).toBe(input);
    // 共有の発信者は結果に含めず、文書の発信者だけが並ぶ
    expect(subjectIds(result.outcome?.originators ?? [])).toEqual([
      opId.originator,
    ]);
  });

  test("他の文書に設置された OPS は CA の検証に用いない", async () => {
    const { authorityOp, certifierOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;
    // 発行者の Core Profile は兄弟の文書にしかない
    const { privateKey } = await generateKey();
    const ca = await signCa(article, privateKey, signOptions);

    const result = await verifyDocument(
      target({
        cas: [ca],
        url: "https://www.example.org/articles/example",
        frameType: "sub_frame",
      }),
      { registry, shared: await sharedRegistry(registry), logger: silent },
    );

    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]).toMatchObject({
      type: problemType(CasVerifyFailed.code),
      pointer: "$.cas",
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        type: problemType(CoreProfileNotFound.code),
        pointer: "$.cas[0].attestation",
      }),
    );
  });

  test("Web サイトの発信者はトップレベル文書の検証鍵に加わる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    // 発行者の Core Profile は Web サイトの発信者にだけある
    const { privateKey } = await generateKey();
    const ca = await signCa(article, privateKey, signOptions);

    const result = await verifyDocument(
      target({ cas: [ca], url: "https://www.example.org/articles/example" }),
      {
        registry,
        shared: await sharedSite(registry, [originatorOp]),
        logger: silent,
      },
    );

    // 発行者の Core Profile は見つかり、署名の検証まで進む
    expect(result.errors ?? []).not.toContainEqual(
      expect.objectContaining({ type: problemType(CoreProfileNotFound.code) }),
    );
    expect(result.inputRange).toContainEqual({ kind: "site-profile" });
  });

  test("Web サイトの発信者をサブフレームの検証に用いない", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;
    const shared = await sharedSite(registry, [originatorOp]);

    await expect(
      verifyDocument(target({ frameType: "sub_frame" }), {
        registry,
        shared,
        logger: silent,
      }),
    ).rejects.toThrow(TypeError);
  });

  test("共有の発信者の検証に失敗していれば文書の検証も失敗する", async () => {
    const { authorityOp, originatorOp } = await buildOpsFixture();
    // Profile Annotation 発行者の Core Profile がどこにもない
    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;
    const shared = await sharedSite(registry, [originatorOp]);

    const result = await verifyDocument(target(), {
      registry,
      shared,
      logger: silent,
    });

    assert(!result.status, "検証は失敗するはず");
    // 共有の発信者の中を指す問題は含めず、失敗の要約だけを載せる
    expect(result.errors).toEqual(
      shared.site.errors?.filter(({ pointer }) => !pointer),
    );
    expect(result.errors).not.toHaveLength(0);
    expect(result.outcome?.originators).toEqual([]);
  });

  test("文書の OPS の検証に失敗した場合はその理由を返す", async () => {
    const { authorityOp, originatorOp } = await buildOpsFixture();
    // Profile Annotation 発行者の Core Profile がどこにもない
    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(target({ ops: [originatorOp] }), {
      registry,
      shared: await sharedRegistry(registry),
      logger: silent,
    });

    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]?.type).toBe(problemType(OpsVerifyFailed.code));
    // 文書の発信者の位置を指す
    expect(result.errors).toContainEqual(
      expect.objectContaining({ pointer: "$.originators[0]" }),
    );
  });

  test("CAS の検証に失敗した場合はその位置を示す", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      target({ ops: [originatorOp], cas: ["not-a-jwt"] }),
      { registry, shared: await sharedRegistry(registry), logger: silent },
    );

    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]).toMatchObject({
      type: problemType(CasVerifyFailed.code),
      pointer: "$.cas",
    });
    // 復号できなかった CA は null で位置が保たれる
    expect(result.outcome?.cas).toEqual([{ main: false, attestation: null }]);
  });

  test("検証時刻・時刻の境界・検証範囲を結果に載せる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      target({ ops: [originatorOp], frameType: "sub_frame" }),
      { registry, shared: await sharedRegistry(registry), logger: silent },
    );

    expect(Date.parse(result.verifiedAt)).not.toBeNaN();
    expect(result.validUntil).toBe(signOptions.expiredAt.toISOString());
    // image データ型の検証の失敗は、移行期間中は結果の状態に反映しない
    expect(result.scope).not.toContain("image");
    expect(result.inputRange).toEqual([
      { kind: "registry" },
      { kind: "document", url: "https://www.example.org/a" },
    ]);
  });

  test("文書の検証中の通知を、文書の発信者の位置で結果に載せる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(target({ ops: [originatorOp] }), {
      registry,
      shared: await sharedRegistry(registry),
      logger: silent,
    });

    // 非推奨の Certificate を検出した通知が、位置とともに warnings に載る
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        pointer: expect.stringMatching(
          /^\$\.originators\[0\]\.annotations\[\d+\]$/,
        ),
      }),
    );
  });
});
