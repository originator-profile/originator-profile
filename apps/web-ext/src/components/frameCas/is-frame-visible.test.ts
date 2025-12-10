import { expect, test } from "vitest";
import { isFrameVisible } from "./is-frame-visible";

test("iframe が完全にビューポート内に収まっている場合は true を返す", () => {
  const rect = {
    left: 10,
    top: 10,
    right: 100,
    bottom: 100,
    width: 90,
    height: 90,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(true);
});

test("iframe がビューポートの境界線上にある場合は true を返す", () => {
  const rect = {
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(true);
});

test("iframe の左側がビューポートからはみ出している場合でも一部見えていれば true を返す", () => {
  const rect = {
    left: -10,
    top: 10,
    right: 100,
    bottom: 100,
    width: 110,
    height: 90,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(true);
});

test("iframe の上側がビューポートからはみ出している場合でも一部見えていれば true を返す", () => {
  const rect = {
    left: 10,
    top: -10,
    right: 100,
    bottom: 100,
    width: 90,
    height: 110,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(true);
});

test("iframe の右側がビューポートからはみ出している場合でも一部見えていれば true を返す", () => {
  const rect = {
    left: 750,
    top: 10,
    right: 850,
    bottom: 100,
    width: 100,
    height: 90,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(true);
});

test("iframe の下側がビューポートからはみ出している場合でも一部見えていれば true を返す", () => {
  const rect = {
    left: 10,
    top: 550,
    right: 100,
    bottom: 650,
    width: 90,
    height: 100,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(true);
});

test("iframe が完全にビューポート外（上）にある場合は false を返す", () => {
  const rect = {
    left: 10,
    top: -200,
    right: 100,
    bottom: -100,
    width: 90,
    height: 100,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(false);
});

test("iframe が完全にビューポート外（下）にある場合は false を返す", () => {
  const rect = {
    left: 10,
    top: 700,
    right: 100,
    bottom: 800,
    width: 90,
    height: 100,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(false);
});

test("iframe が完全にビューポート外（左）にある場合は false を返す", () => {
  const rect = {
    left: -200,
    top: 10,
    right: -100,
    bottom: 100,
    width: 100,
    height: 90,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(false);
});

test("iframe が完全にビューポート外（右）にある場合は false を返す", () => {
  const rect = {
    left: 900,
    top: 10,
    right: 1000,
    bottom: 100,
    width: 100,
    height: 90,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(false);
});

test("iframe の width が 0 の場合は false を返す", () => {
  const rect = {
    left: 10,
    top: 10,
    right: 10,
    bottom: 100,
    width: 0,
    height: 90,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(false);
});

test("iframe の height が 0 の場合は false を返す", () => {
  const rect = {
    left: 10,
    top: 10,
    right: 100,
    bottom: 10,
    width: 90,
    height: 0,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(false);
});

test("カスタムビューポートサイズを指定できる", () => {
  const rect = {
    left: 10,
    top: 10,
    right: 100,
    bottom: 100,
    width: 90,
    height: 90,
  } as DOMRect;

  // カスタムビューポート (200x200) では完全に見えている
  expect(isFrameVisible(rect, 200, 200)).toBe(true);

  // 小さいビューポート (50x50) でも一部見えている
  expect(isFrameVisible(rect, 50, 50)).toBe(true);

  // 完全にビューポート外
  expect(isFrameVisible(rect, 5, 5)).toBe(false);
});

test("iframe のサイズが負の値の場合は false を返す", () => {
  const rect = {
    left: 10,
    top: 10,
    right: 100,
    bottom: 100,
    width: -10,
    height: 90,
  } as DOMRect;

  expect(isFrameVisible(rect, 800, 600)).toBe(false);
});
