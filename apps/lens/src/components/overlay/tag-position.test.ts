import { describe, expect, test } from "vitest";
import { tagPositionOf } from "./tag-position";

const viewport = { width: 1000, height: 800 };
const tag = { width: 200, height: 32 };
const rect = (top: number, bottom: number, left = 400, width = 200) => ({
  top,
  bottom,
  left,
  width,
});

describe("tagPositionOf", () => {
  test("範囲の上に余白があれば上に置く", () => {
    expect(tagPositionOf(rect(100, 300), viewport, tag)).toMatchObject({
      placement: "above",
      top: 100,
    });
  });

  test("上に余白が無く下にあれば下に置く", () => {
    expect(tagPositionOf(rect(20, 300), viewport, tag)).toMatchObject({
      placement: "below",
      top: 300,
    });
  });

  test("上下とも余白が無ければ、見えている部分の上端の内側に置く", () => {
    expect(tagPositionOf(rect(-200, 1200), viewport, tag)).toMatchObject({
      placement: "inside",
      top: 0,
    });
    expect(tagPositionOf(rect(10, 790), viewport, tag)).toMatchObject({
      placement: "inside",
      top: 10,
    });
  });

  test("範囲の中央に合わせ、しっぽをタグの中央に置く", () => {
    expect(tagPositionOf(rect(100, 300), viewport, tag)).toMatchObject({
      left: 400,
      tailX: 100,
    });
  });

  test("画面の左右からはみ出す分だけずらし、しっぽは範囲の中央を指す", () => {
    expect(
      tagPositionOf(rect(100, 300, -100, 120), viewport, tag),
    ).toMatchObject({ left: 8, tailX: 16 });
    expect(
      tagPositionOf(rect(100, 300, 900, 100), viewport, tag),
    ).toMatchObject({ left: 792, tailX: 158 });
  });
});
