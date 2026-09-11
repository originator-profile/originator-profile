import { expect, sidepanel, test } from "../fixtures";

test("English UI messages are displayed correctly", async ({ context }) => {
  const ext = await sidepanel(context);

  const language = await ext.evaluate(() => navigator.language);
  expect(language).toBe("en-US");

  await expect(
    ext.getByText("This site does not support OP yet"),
    "Verify that the English text is displayed",
  ).toBeVisible();
});
