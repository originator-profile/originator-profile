import {
  OpsInvalid,
  OpsVerifyFailed,
  problemType,
  type DocumentOutcome,
  type VerificationResult,
  type VerificationTarget,
} from "@originator-profile/verify";
import { describe, expect, test } from "vitest";
import { toLegacyDocument } from "./to-legacy-result";

/**
 * OPS の検証に失敗した結果を組み立てる
 *
 * 検証器はルートの要約と `$.originators` を指す詳細の両方を errors に載せる。
 */
const opsFailure = (
  code: string,
): VerificationResult<DocumentOutcome<VerificationTarget>> => ({
  status: false,
  outcome: {
    target: {
      ops: [],
      cas: [],
      url: "https://www.example.org/",
      frameType: "outermost_frame",
      verifyIntegrity: () => {
        throw new Error("verifyIntegrity should not be called");
      },
    },
    originators: [{ core: null }],
    cas: [],
  },
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

describe("toLegacyDocument", () => {
  test("OPS が無効な結果は OpsInvalid に戻す", () => {
    const legacy = toLegacyDocument(opsFailure(OpsInvalid.code));

    expect(legacy).toBeInstanceOf(OpsInvalid);
  });

  test("OPS の検証に失敗した結果は OpsVerifyFailed に戻す", () => {
    const legacy = toLegacyDocument(opsFailure(OpsVerifyFailed.code));

    expect(legacy).toBeInstanceOf(OpsVerifyFailed);
  });
});
