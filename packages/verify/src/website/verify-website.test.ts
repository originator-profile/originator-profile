import { signJwtVc } from "@originator-profile/securing-mechanism";
import { assert, describe, expect, test } from "vitest";
import { wsp } from "../helper";
import { buildOpsFixture, signOptions } from "../originator-profile-set/helper";
import { prepareRegistry } from "../registry";
import { problemType } from "../result/problem-types";
import { SiteProfileInvalid, SiteProfileVerifyFailed } from "../site-profile";
import { verifyWebsite } from "./verify-website";

/** 検証中の通知を握りつぶす */
const silent = { warn: () => {}, info: () => {} };

describe("verifyWebsite", () => {
  test("レジストリの OPS が Site Profile の originators に結合される", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    // Profile Annotation 発行者の Core Profile をレジストリ側だけが持つ状態にする
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyWebsite("https://originator.example.org", {
      siteProfile: { originators: [originatorOp], sites: [] },
      registry,
      logger: silent,
    });

    // originators の検証は通り、Website Profile がないことだけが失敗の理由になる
    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]).toEqual({
      type: problemType(SiteProfileInvalid.code),
      title: "No Website Profile found",
    });
    // 復号できた発信者は status によらず outcome に含まれる
    expect(result.outcome?.originators).not.toHaveLength(0);
  });

  test("レジストリに発行者の Core Profile がない場合は検証に失敗する", async () => {
    const { authorityOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyWebsite("https://originator.example.org", {
      siteProfile: { originators: [originatorOp], sites: [] },
      registry,
      logger: silent,
    });

    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]?.type).toBe(
      problemType(SiteProfileVerifyFailed.code),
    );
    // 失敗した Profile Annotation の位置が JSONPath で示される
    expect(result.errors.map(({ pointer }) => pointer)).toContain(
      "$.originators[1].annotations[0]",
    );
  });

  test("securing mechanism の情報を位置とともに収集する", async () => {
    const { authorityOp, certifierOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;

    const result = await verifyWebsite("https://originator.example.org", {
      siteProfile: { originators: [originatorOp], sites: [] },
      registry,
      logger: silent,
    });

    const core = result.securingResults.find(
      ({ pointer }) => pointer === "$.originators[0].core",
    );
    expect(core).toMatchObject({ status: true, algorithm: "ES256" });
    expect(core?.source).toBeTypeOf("string");
    expect(core?.verificationKey).toBeDefined();
  });

  test("デコード失敗と混在した WSP も署名検証されてから結果に含まれる", async () => {
    const { authority, authorityOp, certifierOp, originatorOp } =
      await buildOpsFixture();
    const registry = prepareRegistry([authorityOp, certifierOp]);
    if (registry instanceof Error) throw registry;
    // 発行者の Core Profile にない鍵で署名した、デコードはできる WSP
    const invalidSignatureWsp = await signJwtVc(
      wsp,
      authority.privateKey,
      signOptions,
    );

    const result = await verifyWebsite("https://originator.example.org", {
      siteProfile: {
        originators: [originatorOp],
        sites: [invalidSignatureWsp, "invalid-jwt"],
      },
      registry,
      logger: silent,
    });

    assert(!result.status, "検証は失敗するはず");
    expect(result.errors[0]?.type).toBe(problemType(SiteProfileInvalid.code));
    // 署名検証に失敗した WSP のペイロードは outcome に含まれない
    expect(result.outcome?.sites).toEqual([null, null]);
    // 署名検証を通過していない WSP は成功として記録されない
    const sites = result.securingResults.filter(({ pointer }) =>
      pointer.startsWith("$.sites"),
    );
    expect(sites).toMatchObject([
      { pointer: "$.sites[0]", status: false },
      { pointer: "$.sites[1]", status: false },
    ]);
  });
});
