import { generateKey } from "@originator-profile/cryptography";
import { signCa } from "@originator-profile/sign";
import { assert, describe, expect, test } from "vitest";
import { CasVerifyFailed } from "../content-attestation-set";
import { article, opId } from "../helper";
import type { VerifyIntegrity } from "../integrity";
import {
  CoreProfileNotFound,
  OpsVerifyFailed,
} from "../originator-profile-set";
import { buildOpsFixture, signOptions } from "../originator-profile-set/helper";
import { prepareRegistry } from "../registry";
import type { OriginatorPayload } from "../result/convert";
import { problemType } from "../result/problem-types";
import { verifyDocument } from "./verify-document";

/** 検証中の通知を握りつぶす */
const silent = { warn: () => {}, info: () => {} };

/** CAS が空の文書、または発行者の Core Profile がない CA では呼ばれない */
const notCalled: VerifyIntegrity = () => {
  throw new Error("verifyIntegrity should not be called");
};

const subjectIds = (ops: OriginatorPayload[]) =>
  ops.flatMap((op) => op.core?.credentialSubject.id ?? []);

describe("verifyDocument", () => {
  test("レジストリと文書の OPS を結合して検証する", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const target = {
      ops: [originatorOp],
      cas: [],
      url: "https://www.example.org/a",
      frameType: "sub_frame" as const,
      verifyIntegrity: notCalled,
    };

    const result = await verifyDocument(target, { registry, logger: silent });

    expect(result.status).toBe(true);
    expect(result.outcome?.target).toBe(target);
    expect(subjectIds(result.outcome?.originators ?? [])).toContain(
      opId.originator,
    );
  });

  test("他の文書に設置された OPS は CA の検証に用いない", async () => {
    const { authorityOp, certifierOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;
    // 発行者の Core Profile は兄弟の文書にしかない
    const { privateKey } = await generateKey();
    const ca = await signCa(article, privateKey, signOptions);

    const result = await verifyDocument(
      {
        ops: [],
        cas: [ca],
        url: "https://www.example.org/articles/example",
        frameType: "sub_frame",
        verifyIntegrity: notCalled,
      },
      { registry, logger: silent },
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

  test("Site Profile の発信者はトップレベル文書の検証鍵に加わる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      {
        ops: [],
        cas: [],
        url: "https://www.example.org/a",
        frameType: "outermost_frame",
        verifyIntegrity: notCalled,
      },
      { registry, siteOriginators: [originatorOp], logger: silent },
    );

    expect(result.status).toBe(true);
    expect(subjectIds(result.outcome?.originators ?? [])).toContain(
      opId.originator,
    );
    expect(result.inputRange).toContainEqual({ kind: "site-profile" });
  });

  test("Site Profile の発信者はサブフレームの検証鍵に加わらない", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      {
        ops: [],
        cas: [],
        url: "https://www.example.org/a",
        frameType: "sub_frame",
        verifyIntegrity: notCalled,
      },
      { registry, siteOriginators: [originatorOp], logger: silent },
    );

    expect(result.status).toBe(true);
    expect(subjectIds(result.outcome?.originators ?? [])).not.toContain(
      opId.originator,
    );
    expect(result.inputRange).toEqual([
      { kind: "registry" },
      { kind: "document", url: "https://www.example.org/a" },
    ]);
  });

  test("CAS の検証に失敗した場合はその位置を示す", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      {
        ops: [originatorOp],
        cas: ["not-a-jwt"],
        url: "https://www.example.org/a",
        frameType: "outermost_frame",
        verifyIntegrity: notCalled,
      },
      { registry, logger: silent },
    );

    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]).toMatchObject({
      type: problemType(CasVerifyFailed.code),
      pointer: "$.cas",
    });
    // 復号できなかった CA は null で位置が保たれる
    expect(result.outcome?.cas).toEqual([{ main: false, attestation: null }]);
  });

  test("OPS の検証に失敗した場合はその理由を返す", async () => {
    const { authorityOp, originatorOp } = await buildOpsFixture();
    // Profile Annotation 発行者の Core Profile がどこにもない
    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      {
        ops: [originatorOp],
        cas: [],
        url: "https://www.example.org/a",
        frameType: "outermost_frame",
        verifyIntegrity: notCalled,
      },
      { registry, logger: silent },
    );

    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]?.type).toBe(problemType(OpsVerifyFailed.code));
    // 失敗しても復号できた発信者は outcome に含まれる
    expect(result.outcome?.originators).not.toHaveLength(0);
  });

  test("検証時刻・時刻の境界・検証範囲を結果に載せる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      {
        ops: [originatorOp],
        cas: [],
        url: "https://www.example.org/a",
        frameType: "outermost_frame",
        verifyIntegrity: notCalled,
      },
      { registry, logger: silent },
    );

    expect(Date.parse(result.verifiedAt)).not.toBeNaN();
    expect(result.validUntil).toBe(signOptions.expiredAt.toISOString());
    // image データ型の検証の失敗は、移行期間中は結果の状態に反映しない
    expect(result.scope).not.toContain("image");
  });

  test("検証中の通知を結果に載せる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocument(
      {
        ops: [originatorOp],
        cas: [],
        url: "https://www.example.org/a",
        frameType: "outermost_frame",
        verifyIntegrity: notCalled,
      },
      { registry, logger: silent },
    );

    // 非推奨の Certificate を検出した通知が、位置とともに warnings に載る
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        pointer: expect.stringMatching(
          /^\$\.originators\[\d+\]\.annotations\[\d+\]$/,
        ),
      }),
    );
  });
});
