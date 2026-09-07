import type { VerifiedOps } from "@originator-profile/verify";
import { describe, expect, test } from "vitest";
import {
  getDestinationOrgName,
  getOrgNameFromOp,
  isMatched,
  resolveName,
  type VerifiedWsp,
} from "./matching";

/** テスト用の検証済み OP (照合に必要なプロパティのみ) */
function op(id: string, annotationNames?: (string | undefined)[]) {
  return {
    core: { doc: { credentialSubject: { id } } },
    annotations: annotationNames?.map((name) => ({
      doc: { credentialSubject: name === undefined ? {} : { name } },
    })),
  } as unknown as VerifiedOps[number];
}

/** テスト用の検証済み WSP (照合に必要なプロパティのみ) */
function wsp(issuer: string, name?: string) {
  return {
    doc: {
      issuer,
      credentialSubject: name === undefined ? {} : { name },
    },
  } as unknown as VerifiedWsp;
}

describe("isMatched", () => {
  test("issuer が targetOpId に一致する WSP があれば true", () => {
    expect(
      isMatched([wsp("dns:other"), wsp("dns:example")], "dns:example"),
    ).toBe(true);
  });

  test("一致する WSP がなければ false", () => {
    expect(isMatched([wsp("dns:other")], "dns:example")).toBe(false);
  });

  test("WSP が空なら false", () => {
    expect(isMatched([], "dns:example")).toBe(false);
  });
});

describe("getOrgNameFromOp", () => {
  test("name を持つ Profile Annotation の name を返す", () => {
    expect(getOrgNameFromOp(op("dns:example", [undefined, "組織名"]))).toBe(
      "組織名",
    );
  });

  test("name を持つ Profile Annotation がなければ undefined", () => {
    expect(getOrgNameFromOp(op("dns:example", [undefined]))).toBeUndefined();
  });

  test("Profile Annotation を持たなければ undefined", () => {
    expect(getOrgNameFromOp(op("dns:example"))).toBeUndefined();
  });
});

describe("resolveName", () => {
  test("WSP の issuer に対応する OP の Profile Annotation 名を優先する", () => {
    const originators = [op("dns:example", ["OP の組織名"])];
    expect(resolveName(wsp("dns:example", "WSP の名前"), originators)).toBe(
      "OP の組織名",
    );
  });

  test("対応する OP がなければ WSP の名前にフォールバックする", () => {
    expect(resolveName(wsp("dns:example", "WSP の名前"), [])).toBe(
      "WSP の名前",
    );
  });

  test("OP に名前がなければ WSP の名前にフォールバックする", () => {
    const originators = [op("dns:example", [undefined])];
    expect(resolveName(wsp("dns:example", "WSP の名前"), originators)).toBe(
      "WSP の名前",
    );
  });

  test("どちらにも名前がなければ undefined", () => {
    expect(resolveName(wsp("dns:example"), [])).toBeUndefined();
  });
});

describe("getDestinationOrgName", () => {
  const originators = [
    op("dns:example", ["Example 組織"]),
    op("dns:other", ["Other 組織"]),
  ];

  test("targetOpId に一致する WSP から解決する", () => {
    const sites = [wsp("dns:other"), wsp("dns:example")];
    expect(getDestinationOrgName(originators, sites, "dns:example")).toBe(
      "Example 組織",
    );
  });

  test("一致する WSP がなければ先頭の WSP から解決する", () => {
    const sites = [wsp("dns:other"), wsp("dns:example")];
    expect(getDestinationOrgName(originators, sites, "dns:unknown")).toBe(
      "Other 組織",
    );
  });

  test("WSP が空なら undefined", () => {
    expect(
      getDestinationOrgName(originators, [], "dns:example"),
    ).toBeUndefined();
  });
});
