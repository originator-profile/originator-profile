import { describe, expect, test } from "vitest";
import { buildOpsFixture } from "../originator-profile-set/helper";
import { prepareRegistry } from "../registry";
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

    const verified = await verifyWebsite("https://originator.example.org", {
      siteProfile: { originators: [originatorOp], sites: [] },
      registry,
      logger: silent,
    });

    // originators の検証は通り、Website Profile がないことだけが失敗の理由になる
    expect(verified).toBeInstanceOf(SiteProfileInvalid);
    expect((verified as Error).message).toBe("No Website Profile found");
  });

  test("レジストリに発行者の Core Profile がない場合は検証に失敗する", async () => {
    const { authorityOp, originatorOp } = await buildOpsFixture();
    const registry = prepareRegistry([authorityOp]);
    if (registry instanceof Error) throw registry;

    const verified = await verifyWebsite("https://originator.example.org", {
      siteProfile: { originators: [originatorOp], sites: [] },
      registry,
      logger: silent,
    });

    expect(verified).toBeInstanceOf(SiteProfileVerifyFailed);
  });
});
