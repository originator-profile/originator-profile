import type { WebsiteProfile } from "@originator-profile/model";
import type { OriginatorPayload } from "@originator-profile/verify";
import { describe, expect, test } from "vitest";
import {
  getOrgNameFromOp,
  isMatched,
  resolveActualOperator,
  resolveName,
} from "./matching";

/**
 * テスト用の発信者ペイロード (照合に必要なプロパティのみ)
 *
 * mediaNames の undefined は復号できなかった WMP を表す。
 */
function op(
  id: string,
  mediaNames?: (string | undefined)[],
): OriginatorPayload {
  return {
    core: { credentialSubject: { id } },
    media: mediaNames?.map((name) =>
      name === undefined ? null : { credentialSubject: { name } },
    ),
  } as unknown as OriginatorPayload;
}

/** テスト用の Website Profile (照合に必要なプロパティのみ) */
function wsp(issuer: string, name?: string): WebsiteProfile {
  return {
    issuer,
    credentialSubject: name === undefined ? {} : { name },
  } as unknown as WebsiteProfile;
}

describe("isMatched", () => {
  test("issuer が宣言された OP ID に一致する WSP があれば true", () => {
    expect(
      isMatched([wsp("dns:other"), wsp("dns:example")], "dns:example"),
    ).toBe(true);
  });

  test("一致する WSP がなければ false", () => {
    expect(isMatched([wsp("dns:other")], "dns:example")).toBe(false);
  });

  test("復号できなかった WSP は照合に使わない", () => {
    expect(isMatched([null], "dns:example")).toBe(false);
  });

  test("WSP が空なら false", () => {
    expect(isMatched([], "dns:example")).toBe(false);
  });
});

describe("getOrgNameFromOp", () => {
  test("Web Media Profile の name を返す", () => {
    expect(getOrgNameFromOp(op("dns:example", ["組織名"]))).toBe("組織名");
  });

  test("復号できなかった WMP は使わない", () => {
    expect(getOrgNameFromOp(op("dns:example", [undefined, "組織名"]))).toBe(
      "組織名",
    );
  });

  test("すべての WMP が復号できなければ undefined", () => {
    expect(getOrgNameFromOp(op("dns:example", [undefined]))).toBeUndefined();
  });

  test("Web Media Profile を持たなければ undefined", () => {
    expect(getOrgNameFromOp(op("dns:example"))).toBeUndefined();
  });
});

describe("resolveName", () => {
  test("WSP の issuer に対応する OP の組織名を返す", () => {
    const originators = [op("dns:example", ["OP の組織名"])];
    expect(resolveName(wsp("dns:example", "WSP の名前"), originators)).toBe(
      "OP の組織名",
    );
  });

  test("対応する OP がなければ undefined。サイト名は組織名ではないため使わない", () => {
    expect(resolveName(wsp("dns:example", "WSP の名前"), [])).toBeUndefined();
  });

  test("OP に組織名がなければ undefined", () => {
    const originators = [op("dns:example", [undefined])];
    expect(
      resolveName(wsp("dns:example", "WSP の名前"), originators),
    ).toBeUndefined();
  });
});

describe("resolveActualOperator", () => {
  const originators = [
    op("dns:example", ["Example 組織"]),
    op("dns:other", ["Other 組織"]),
  ];

  test("宣言された OP ID に一致する WSP から解決する", () => {
    const sites = [wsp("dns:other"), wsp("dns:example")];
    expect(resolveActualOperator(originators, sites, "dns:example")).toEqual({
      id: "dns:example",
      name: "Example 組織",
    });
  });

  test("一致する WSP がなければ他の WSP から解決する", () => {
    const sites = [wsp("dns:other"), wsp("dns:example")];
    expect(resolveActualOperator(originators, sites, "dns:unknown")).toEqual({
      id: "dns:other",
      name: "Other 組織",
    });
  });

  test("復号できなかった WSP はフォールバックの対象にしない", () => {
    const sites = [null, wsp("dns:other")];
    expect(resolveActualOperator(originators, sites, "dns:unknown")).toEqual({
      id: "dns:other",
      name: "Other 組織",
    });
  });

  test("組織名が解決できなくても OP ID は返す", () => {
    expect(
      resolveActualOperator([], [wsp("dns:nameless")], "dns:nameless"),
    ).toEqual({ id: "dns:nameless", name: undefined });
  });

  test("WSP が空なら undefined", () => {
    expect(
      resolveActualOperator(originators, [], "dns:example"),
    ).toBeUndefined();
  });
});
