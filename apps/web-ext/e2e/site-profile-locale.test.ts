import { mergeTests } from "@playwright/test";
import privateKey from "./account-key.example.priv.json" with { type: "json" };
import publicKey from "./account-key.example.pub.json" with { type: "json" };
import { test as base, expect, sidepanel } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";
import { test as staticHtmlTest } from "./static-html-fixtures";

const test = mergeTests(base, siteProfileTest, staticHtmlTest).extend({});

test("複数ロケールのSite Profile - 日本語ロケールで日本語コンテンツを表示", async ({
  context,
  page,
  multiLocaleSiteProfile,
  credentialsMissingPage,
}) => {
  // 日本語ロケールを設定
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "language", {
      get: () => "ja-JP",
    });
  });

  await multiLocaleSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);

  await expect(ext?.getByTestId("site-profile")).toBeVisible();

  // 日本語のWebsite Profileが選択されていることを確認
  expect(await ext?.getByTestId("site-profile-wsp-name").innerText()).toBe(
    "SiteProfileの取得検証",
  );

  // 日本語のWeb Media Profileが選択されていることを確認
  await expect(
    ext?.getByText("Originator Profile 技術研究組合 (開発用)"),
  ).toBeVisible();
});

test("複数ロケールのSite Profile - 英語ロケールで英語コンテンツを表示", async ({
  context,
  page,
  multiLocaleSiteProfile,
  credentialsMissingPage,
}) => {
  // 英語ロケールを設定
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "language", {
      get: () => "en-US",
    });
  });

  await multiLocaleSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);

  await expect(ext?.getByTestId("site-profile")).toBeVisible();

  // 英語のWebsite Profileが選択されていることを確認
  expect(await ext?.getByTestId("site-profile-wsp-name").innerText()).toBe(
    "Site Profile Verification",
  );

  // 英語のWeb Media Profileが選択されていることを確認
  await expect(
    ext?.getByText(
      "Originator Profile Technology Research Association (Development)",
    ),
  ).toBeVisible();
});

test("複数ロケールのSite Profile - 未対応ロケールで英語フォールバック", async ({
  context,
  page,
  multiLocaleSiteProfile,
  credentialsMissingPage,
}) => {
  // サポートされていないロケール(フランス語)を設定
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "language", {
      get: () => "fr-FR",
    });
  });

  await multiLocaleSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await sidepanel(context);

  await expect(ext?.getByTestId("site-profile")).toBeVisible();

  // 英語にフォールバックされることを確認
  expect(await ext?.getByTestId("site-profile-wsp-name").innerText()).toBe(
    "Site Profile Verification",
  );
  await expect(
    ext?.getByText(
      "Originator Profile Technology Research Association (Development)",
    ),
  ).toBeVisible();
});
