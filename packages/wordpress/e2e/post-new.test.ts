import { expect, test } from "@wordpress/e2e-test-utils-playwright";
import path from "node:path";

test("投稿の検証", async ({ admin, editor }) => {
  const content = "海は昼眠る、夜も眠る。ごうごう、いびきをかいて眠る。";

  await admin.createNewPost({ content });

  const page = await editor.openPreviewPage();
  await editor.publishPost();

  const text = await page
    .locator(".wp-block-post-content>*:not(.post-nav-links)")
    .allTextContents()
    .then((ts) => ts.join(""));

  expect(text).toBe(content);
});

test("画像のintegrity属性に複数のSRIハッシュが含まれる", async ({
  admin,
  editor,
}) => {
  const content = "画像付き投稿のテスト";
  const imagePath = path.resolve(
    import.meta.dirname,
    "../assets/ca-manager.webp",
  );

  await admin.createNewPost({ content });
  await editor.insertBlock({ name: "core/image" });
  const imageBlock = editor.canvas.locator('[data-type="core/image"]');
  const fileInput = imageBlock.locator('input[type="file"]');
  await fileInput.setInputFiles(imagePath);
  await imageBlock
    .locator(".components-spinner")
    .waitFor({ state: "detached" });

  const page = await editor.openPreviewPage();
  await editor.publishPost();

  const img = page.locator(".wp-block-image img");
  await expect(img).toBeVisible();

  expect(
    await img.getAttribute("integrity"),
    "画像のintegrity属性に2つ以上のSRIハッシュが含まれること",
  ).toMatch(/^sha256-[A-Za-z0-9+/=]+\s+sha256-[A-Za-z0-9+/=]+\b/);
});
