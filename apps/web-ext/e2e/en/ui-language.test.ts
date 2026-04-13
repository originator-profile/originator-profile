import { expect, sidepanel, test } from "../fixtures";

test("English UI messages are displayed correctly", async ({ context }) => {
  const ext = await sidepanel(context);

  const language = await ext.evaluate(() => navigator.language);
  expect(language).toBe("en-US");

  await expect(
    ext.getByText(
      "Please contact the site operator regarding the originator of this web page",
    ),
    "Verify that the English text is displayed",
  ).toBeVisible();
});
