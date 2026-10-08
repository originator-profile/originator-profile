import type { ContentAttestation } from "@originator-profile/model";
import { describe, expect, test } from "vitest";
import type { FrameCredentials } from "../credentials/types";
import {
  dependsOnRenderedResult,
  InvalidationType,
  isAllowedUrlConsistent,
  isRegistryEntryReusable,
  isReusable,
  resolveEntry,
  toInputIdentity,
} from "./identity";
import type { RegistryEntry, VerificationEntry } from "./types";

/** 文書から取得したクレデンシャル */
const credentials: Pick<FrameCredentials, "ops" | "cas"> = {
  ops: [
    {
      source: { kind: "embedded", elementIndex: 0 },
      credential: { core: "eyJ.ops" },
    },
  ],
  cas: [],
};

const url = "https://www.example.org/articles/1";

async function settled(
  overrides: { validUntil?: string; allowedUrl?: string } = {},
): Promise<Extract<VerificationEntry, { state: "settled" }>> {
  const attestation = {
    allowedUrl: overrides.allowedUrl ?? "https://www.example.org/articles/*",
  } as ContentAttestation;
  return {
    state: "settled",
    subject: {
      tabId: 1,
      frameId: 0,
      parentFrameId: -1,
      documentId: "doc",
      frameType: "outermost_frame",
      url,
      origin: "https://www.example.org",
    },
    credentials: {
      ops: credentials.ops.map(({ source }) => ({ source })),
      cas: [],
    },
    result: {
      status: true,
      outcome: { originators: [], cas: [{ main: true, attestation }] },
      securingResults: [],
      warnings: [],
      info: [],
      verifiedAt: "2026-10-01T00:00:00.000Z",
      validUntil: overrides.validUntil,
      scope: ["ca-vc", "allowed-url", "content-integrity", "originator-ops"],
      inputRange: [{ kind: "registry" }, { kind: "document", url }],
    },
    inputIdentity: await toInputIdentity(credentials, url),
  };
}

const now = new Date("2026-10-08T00:00:00.000Z");

describe("isReusable", () => {
  test("入力同一性が保たれていれば再利用できる", async () => {
    const entry = await settled();
    const current = await toInputIdentity(credentials, url);

    expect(await isReusable(entry, current, now)).toBe(true);
  });

  test("保持している判定手段のキーの順序が変わっても再利用できる", async () => {
    const entry = await settled();
    const { cas, ops, targets, evaluatedUrl } = entry.inputIdentity;
    const reordered = {
      ...entry,
      inputIdentity: {
        targets: targets.map(({ pointer, dependency }) => ({
          dependency,
          pointer,
        })),
        evaluatedUrl,
        ops: ops.map(({ source, digest }) => ({ digest, source })),
        cas,
      },
    };
    const current = await toInputIdentity(credentials, url);

    expect(await isReusable(reordered, current, now)).toBe(true);
  });

  test("クレデンシャルの内容が変われば再利用しない", async () => {
    const entry = await settled();
    const current = await toInputIdentity(
      {
        ...credentials,
        ops: [
          {
            source: { kind: "embedded", elementIndex: 0 },
            credential: { core: "eyJ.changed" },
          },
        ],
      },
      url,
    );

    expect(await isReusable(entry, current, now)).toBe(false);
  });

  test("時刻の境界を過ぎていれば再利用しない", async () => {
    const entry = await settled({ validUntil: "2026-10-07T00:00:00.000Z" });
    const current = await toInputIdentity(credentials, url);

    expect(await isReusable(entry, current, now)).toBe(false);
  });

  test("allowedUrl の評価結果が変われば再利用しない", async () => {
    const entry = await settled();
    const current = await toInputIdentity(
      credentials,
      "https://www.example.org/about",
    );

    expect(await isReusable(entry, current, now)).toBe(false);
  });

  test("確定していない状態は再利用しない", async () => {
    const { subject } = await settled();
    const current = await toInputIdentity(credentials, url);

    expect(
      await isReusable({ state: "unverified", subject }, current, now),
    ).toBe(false);
  });
});

describe("isAllowedUrlConsistent", () => {
  test("評価結果が一致すれば URL が変わっても一致とみなす", async () => {
    const entry = await settled();

    expect(
      await isAllowedUrlConsistent(entry, "https://www.example.org/articles/2"),
    ).toBe(true);
    expect(
      await isAllowedUrlConsistent(entry, "https://www.example.org/about"),
    ).toBe(false);
  });
});

describe("resolveEntry", () => {
  test("時刻の境界を過ぎた結果は無効として扱う", async () => {
    const entry = await settled({ validUntil: "2026-10-07T00:00:00.000Z" });

    expect(resolveEntry(entry, now)).toMatchObject({
      state: "invalidated",
      reason: { type: InvalidationType.Expired },
    });
  });

  test("時刻の境界より前の結果はそのまま", async () => {
    const entry = await settled({ validUntil: "2026-10-09T00:00:00.000Z" });

    expect(resolveEntry(entry, now)).toBe(entry);
  });
});

describe("dependsOnRenderedResult", () => {
  test("rendered result に依存する target を含むか", async () => {
    const entry = await settled();

    expect(dependsOnRenderedResult(entry)).toBe(false);
    expect(
      dependsOnRenderedResult({
        ...entry,
        inputIdentity: {
          ...entry.inputIdentity,
          targets: [{ pointer: "$.cas[0]", dependency: "rendered-result" }],
        },
      }),
    ).toBe(true);
  });
});

describe("isRegistryEntryReusable", () => {
  const registryAt = (...expiredAt: (string | undefined)[]): RegistryEntry => ({
    status: true,
    outcome: { originators: [] },
    securingResults: expiredAt.map((value, i) => ({
      pointer: `$.originators[${i}].core`,
      status: true,
      expiredAt: value,
    })),
    warnings: [],
    info: [],
  });

  test("用いた VC の有効期限がすべて現在時刻より後なら再利用する", () => {
    expect(
      isRegistryEntryReusable(
        registryAt("2026-10-09T00:00:00.000Z", undefined),
        new Date("2026-10-08T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  test("有効期限を過ぎた VC があれば検証し直す", () => {
    expect(
      isRegistryEntryReusable(
        registryAt("2026-10-09T00:00:00.000Z", "2026-10-07T00:00:00.000Z"),
        new Date("2026-10-08T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  test("保持していなければ検証する", () => {
    expect(isRegistryEntryReusable(undefined, new Date())).toBe(false);
  });
});
