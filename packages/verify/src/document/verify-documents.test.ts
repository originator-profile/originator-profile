import { describe, expect, test } from "vitest";
import { CasVerifyFailed } from "../content-attestation-set";
import { opId } from "../helper";
import type { VerifyIntegrity } from "../integrity";
import { OpsVerifyFailed } from "../originator-profile-set";
import { buildOpsFixture } from "../originator-profile-set/helper";
import { prepareRegistry } from "../registry";
import type { OriginatorPayload } from "../result/convert";
import { problemType } from "../result/problem-types";
import { verifyDocuments } from "./verify-documents";

/** 検証中の通知を握りつぶす */
const silent = { warn: () => {}, info: () => {} };

/** CAS が空の文書では呼ばれない */
const notCalled: VerifyIntegrity = () => {
  throw new Error("verifyIntegrity should not be called");
};

const subjectIds = (ops: OriginatorPayload[]) =>
  ops.flatMap((op) => op.core?.credentialSubject.id ?? []);

describe("verifyDocuments", () => {
  test("レジストリと各文書の OPS を結合して検証する", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const targets = [
      {
        ops: [originatorOp],
        cas: [],
        url: "https://www.example.org/a",
        verifyIntegrity: notCalled,
      },
      {
        ops: [],
        cas: [],
        url: "https://www.example.org/b",
        verifyIntegrity: notCalled,
      },
    ];

    const result = await verifyDocuments(targets, { registry, logger: silent });

    expect(result.status).toBe(true);
    expect(result.errors).toEqual([]);
    // 文書ごとの結果が入力とペアで返る
    expect(result.outcome?.documents.map(({ target }) => target.url)).toEqual([
      "https://www.example.org/a",
      "https://www.example.org/b",
    ]);
    // 文書側の OPS がレジストリと結合されて検証される
    expect(subjectIds(result.outcome?.originators ?? [])).toContain(
      opId.originator,
    );
  });

  test("Web サイトが提示する発信者も検証鍵に加わる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocuments([], {
      registry,
      websiteOriginators: [originatorOp],
      logger: silent,
    });

    expect(result.status).toBe(true);
    expect(subjectIds(result.outcome?.originators ?? [])).toContain(
      opId.originator,
    );
  });

  test("いずれかの文書の CAS 検証に失敗した場合はその位置を示す", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocuments(
      [
        {
          ops: [originatorOp],
          cas: [],
          url: "https://www.example.org/a",
          verifyIntegrity: notCalled,
        },
        {
          ops: [],
          cas: ["not-a-jwt"],
          url: "https://www.example.org/b",
          verifyIntegrity: notCalled,
        },
      ],
      { registry, logger: silent },
    );

    expect(result.status).toBe(false);
    expect(result.errors[0]).toMatchObject({
      type: problemType(CasVerifyFailed.code),
      pointer: "$.documents[1]",
    });
    // 復号できなかった CA は null で位置が保たれる
    expect(result.outcome?.documents[1]?.cas).toEqual([
      { main: false, attestation: null },
    ]);
  });

  test("OPS の検証に失敗した場合はその理由を返す", async () => {
    const { authorityOp, originatorOp } = await buildOpsFixture();
    // Profile Annotation 発行者の Core Profile がどこにもない
    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocuments(
      [
        {
          ops: [originatorOp],
          cas: [],
          url: "https://www.example.org/a",
          verifyIntegrity: notCalled,
        },
      ],
      { registry, logger: silent },
    );

    expect(result.status).toBe(false);
    expect(result.errors[0]?.type).toBe(problemType(OpsVerifyFailed.code));
    // 失敗しても復号できた発信者は outcome に含まれる
    expect(result.outcome?.originators).not.toHaveLength(0);
  });

  test("検証中の通知を結果に載せる", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyDocuments(
      [
        {
          ops: [originatorOp],
          cas: [],
          url: "https://www.example.org/a",
          verifyIntegrity: notCalled,
        },
      ],
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
