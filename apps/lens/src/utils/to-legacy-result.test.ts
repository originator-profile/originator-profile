import {
  OpsInvalid,
  OpsVerifyFailed,
  problemType,
  type DocumentsOutcome,
  type VerificationResult,
  type VerificationTarget,
} from "@originator-profile/verify";
import { describe, expect, test } from "vitest";
import { toLegacyDocuments } from "./to-legacy-result";

/**
 * OPS の検証に失敗した結果を組み立てる
 *
 * 検証器はルートの要約と `$.originators` を指す詳細の両方を errors に載せる。
 */
const opsFailure = (
  code: string,
): VerificationResult<DocumentsOutcome<VerificationTarget>> => ({
  status: false,
  outcome: { originators: [{ core: null }], documents: [] },
  securingResults: [],
  warnings: [],
  info: [],
  errors: [
    { type: problemType(code), title: "Originator Profile Set failed" },
    {
      type: problemType(code),
      title: "Originator Profile Set failed",
      pointer: "$.originators",
    },
  ],
});

describe("toLegacyDocuments", () => {
  test("OPS が無効な結果は OpsInvalid に戻す", () => {
    const legacy = toLegacyDocuments(opsFailure(OpsInvalid.code));

    expect(legacy).toBeInstanceOf(OpsInvalid);
  });

  test("OPS の検証に失敗した結果は OpsVerifyFailed に戻す", () => {
    const legacy = toLegacyDocuments(opsFailure(OpsVerifyFailed.code));

    expect(legacy).toBeInstanceOf(OpsVerifyFailed);
  });
});
