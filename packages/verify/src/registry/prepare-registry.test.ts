import { describe, expect, test } from "vitest";
import { OpsInvalid } from "../originator-profile-set";
import { buildOpsFixture } from "../originator-profile-set/helper";
import { prepareRegistry } from "./prepare-registry";

describe("prepareRegistry", () => {
  test("Originator Profile Set から発行者と検証鍵を取り出す", async () => {
    const { ops, authorityCp } = await buildOpsFixture();

    const registry = prepareRegistry(ops);
    if (registry instanceof Error) throw registry;

    expect(registry.ops).toBe(ops);
    // 複数の OP ID を含むため issuer は配列になる
    expect(registry.issuer).toContain(authorityCp.credentialSubject.id);
  });

  test("単一の発行者のみの場合 issuer は文字列になる", async () => {
    const { authorityOp, authorityCp } = await buildOpsFixture();

    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;

    expect(registry.issuer).toBe(authorityCp.credentialSubject.id);
  });

  test("復号に失敗する Originator Profile Set では OpsInvalid を返す", () => {
    expect(prepareRegistry([{ core: "not-a-jwt" }])).toBeInstanceOf(OpsInvalid);
  });
});
