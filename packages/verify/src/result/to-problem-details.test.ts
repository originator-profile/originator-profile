import { describe, expect, test } from "vitest";
import { OpsInvalid } from "../originator-profile-set";
import { ProblemType } from "./problem-types";
import { toProblemDetails } from "./to-problem-details";

describe("toProblemDetails", () => {
  test("エラーコードをエラーリファレンスの URL に対応させる", () => {
    const error = new OpsInvalid("Invalid Originator Profile Set (OP[0])", []);

    expect(toProblemDetails(error)).toEqual({
      type: `https://docs.originator-profile.org/error-reference/${OpsInvalid.code}/`,
      title: "Invalid Originator Profile Set (OP[0])",
    });
  });

  test("位置を渡すと pointer に載せる", () => {
    const error = new OpsInvalid("Invalid", []);

    expect(toProblemDetails(error, "$.originators[0]")).toMatchObject({
      pointer: "$.originators[0]",
    });
  });

  test("result.error のメッセージを detail に載せる", () => {
    const error = Object.assign(new Error("JWT VC Verification Failure"), {
      result: {
        source: "eyJ...",
        error: new Error("signature verification failed"),
      },
    });

    expect(toProblemDetails(error)).toMatchObject({
      title: "JWT VC Verification Failure",
      detail: "signature verification failed",
    });
  });

  test("cause を持つエラーはそのメッセージを detail に載せる", () => {
    const error = new Error("outer", { cause: new Error("inner") });

    expect(toProblemDetails(error)).toEqual({
      type: ProblemType.Unspecified,
      title: "outer",
      detail: "inner",
    });
  });

  test("Error でない値も変換できる", () => {
    expect(toProblemDetails("something")).toEqual({
      type: ProblemType.Unspecified,
      title: "something",
    });
  });
});
