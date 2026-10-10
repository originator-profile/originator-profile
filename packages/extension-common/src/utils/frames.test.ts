import { describe, expect, test } from "vitest";
import { withFrameType } from "./frames";

describe("withFrameType", () => {
  test("frameType と documentLifecycle を返さないブラウザでは親フレームの有無から補う", () => {
    expect(withFrameType({ parentFrameId: -1 })).toMatchObject({
      frameType: "outermost_frame",
      documentLifecycle: "active",
    });
    expect(withFrameType({ parentFrameId: 0 })).toMatchObject({
      frameType: "sub_frame",
      documentLifecycle: "active",
    });
  });

  test("返された frameType と documentLifecycle はそのまま使う", () => {
    expect(
      withFrameType({
        parentFrameId: -1,
        frameType: "outermost_frame",
        documentLifecycle: "prerender",
      }),
    ).toMatchObject({
      frameType: "outermost_frame",
      documentLifecycle: "prerender",
    });
  });
});
