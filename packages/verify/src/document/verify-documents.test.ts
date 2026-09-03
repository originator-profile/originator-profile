import { describe, expect, test } from "vitest";
import { CasVerifyFailed } from "../content-attestation-set";
import { opId } from "../helper";
import type { VerifyIntegrity } from "../integrity";
import { OpsVerifyFailed } from "../originator-profile-set";
import { buildOpsFixture } from "../originator-profile-set/helper";
import { prepareRegistry } from "../registry";
import { verifyDocuments } from "./verify-documents";

/** 検証中の通知を握りつぶす */
const silent = { warn: () => {}, info: () => {} };

/** CAS が空の文書では呼ばれない */
const notCalled: VerifyIntegrity = () => {
  throw new Error("verifyIntegrity should not be called");
};

const subjectIds = (
  ops: { core: { doc: { credentialSubject: { id: string } } } }[],
) => ops.map((op) => op.core.doc.credentialSubject.id);

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
    if (result instanceof Error) throw result;

    // 文書ごとの結果が入力とペアで返る
    expect(result.documents).toHaveLength(2);
    expect(result.documents.map(({ target }) => target.url)).toEqual([
      "https://www.example.org/a",
      "https://www.example.org/b",
    ]);
    // 文書側の OPS がレジストリと結合されて検証される
    expect(subjectIds(result.originators)).toContain(opId.originator);
  });

  test("検証済み Web サイトの発信者が検証済み OPS に加わる", async () => {
    const { authorityOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;

    const base = await verifyDocuments([], { registry, logger: silent });
    if (base instanceof Error) throw base;

    const withWebsite = await verifyDocuments([], {
      registry,
      website: { originators: base.originators, sites: [] },
      logger: silent,
    });
    if (withWebsite instanceof Error) throw withWebsite;

    expect(withWebsite.originators).toHaveLength(base.originators.length * 2);
  });

  test("いずれかの文書の CAS 検証に失敗した場合は最初の失敗のみを返す", async () => {
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

    expect(result).toBeInstanceOf(CasVerifyFailed);
    // 検証を通過した文書の結果も返さない
    expect(result).not.toHaveProperty("documents");
  });

  test("OPS の検証に失敗した場合はその結果を返す", async () => {
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

    expect(result).toBeInstanceOf(OpsVerifyFailed);
  });
});
