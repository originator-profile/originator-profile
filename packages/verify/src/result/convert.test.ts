import { describe, expect, test } from "vitest";
import { CoreProfileNotFound } from "../originator-profile-set";
import { convertOp, convertOps, convertVc, createCollector } from "./convert";
import { problemType } from "./problem-types";

/** テスト用の検証済み VC */
const verifiedVc = (issuer: string) => ({
  doc: { issuer, credentialSubject: { id: issuer } },
  source: "eyJ...",
  issuedAt: new Date("2026-01-01T00:00:00Z"),
  expiredAt: new Date("2027-01-01T00:00:00Z"),
  mediaType: "application/vc+jwt",
  algorithm: "ES256",
  verificationKey: { kid: "key-1" },
});

describe("convertVc", () => {
  test("復号したペイロードを返し、securing 情報を収集する", () => {
    const collect = createCollector();

    const doc = convertVc(verifiedVc("dns:example"), "$.sites[0]", collect);

    expect(doc).toEqual({
      issuer: "dns:example",
      credentialSubject: { id: "dns:example" },
    });
    expect(collect.securingResults).toEqual([
      {
        pointer: "$.sites[0]",
        status: true,
        source: "eyJ...",
        mediaType: "application/vc+jwt",
        algorithm: "ES256",
        issuedAt: new Date("2026-01-01T00:00:00Z"),
        expiredAt: new Date("2027-01-01T00:00:00Z"),
        verificationKey: { kid: "key-1" },
        controller: "dns:example",
      },
    ]);
    expect(collect.errors).toEqual([]);
  });

  test("失敗しても復号できていればペイロードを返す", () => {
    const collect = createCollector();
    const error = new CoreProfileNotFound(
      "Missing Core Profile (dns:example)",
      verifiedVc("dns:example") as never,
    );

    const doc = convertVc(error, "$.sites[0]", collect);

    expect(doc).not.toBeNull();
    expect(collect.securingResults[0]).toMatchObject({
      status: false,
      source: "eyJ...",
    });
    expect(collect.errors).toEqual([
      {
        type: problemType(CoreProfileNotFound.code),
        title: "Missing Core Profile (dns:example)",
        pointer: "$.sites[0]",
      },
    ]);
  });

  test("復号できていなければ null を返し、securing 情報だけ残る", () => {
    const collect = createCollector();
    const error = Object.assign(new Error("JWT VC Verification Failure"), {
      code: "ERR_VC_VERIFY_FAILED",
      result: { source: "eyJ...", error: new Error("signature failed") },
    });

    expect(convertVc(error, "$.sites[0]", collect)).toBeNull();
    expect(collect.securingResults[0]).toEqual({
      pointer: "$.sites[0]",
      status: false,
      source: "eyJ...",
    });
    expect(collect.errors[0]).toMatchObject({
      detail: "signature failed",
      pointer: "$.sites[0]",
    });
  });
});

describe("convertOp", () => {
  test("core / annotations / media の位置を JSONPath で示す", () => {
    const collect = createCollector();

    convertOp(
      {
        core: verifiedVc("dns:example"),
        annotations: [verifiedVc("dns:pa")],
        media: [verifiedVc("dns:example")],
      },
      "$.originators[0]",
      collect,
    );

    expect(collect.securingResults.map(({ pointer }) => pointer)).toEqual([
      "$.originators[0].core",
      "$.originators[0].annotations[0]",
      "$.originators[0].media[0]",
    ]);
  });
});

describe("convertOps", () => {
  test("配列でなければ空の結果を返す", () => {
    const collect = createCollector();

    expect(convertOps(undefined, collect)).toEqual([]);
  });

  test("要素ごとに位置を採番する", () => {
    const collect = createCollector();

    const payloads = convertOps(
      [{ core: verifiedVc("dns:a") }, { core: verifiedVc("dns:b") }],
      collect,
    );

    expect(payloads).toHaveLength(2);
    expect(collect.securingResults.map(({ pointer }) => pointer)).toEqual([
      "$.originators[0].core",
      "$.originators[1].core",
    ]);
  });
});
