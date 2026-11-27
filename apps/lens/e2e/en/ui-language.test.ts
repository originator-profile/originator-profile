import { expect, sidepanel, test } from "../fixtures";

test("English UI messages are displayed correctly", async ({ context }) => {
  const ext = await sidepanel(context);

  const language = await ext.evaluate(() => navigator.language);
  expect(language).toBe("en-US");

  await expect(
    ext.getByText("Site operator information can't be confirmed"),
    "Verify that the English text is displayed",
  ).toBeVisible();
});

test("The corporate registry link opens the English page", async ({
  context,
  page,
}) => {
  await page.goto("http://localhost:8080/examples/iframe");
  const ext = await sidepanel(context);

  await ext.getByTestId("content-card").first().locator("summary").click();
  await expect(
    ext
      .locator("details[open]")
      .getByRole("link", { name: /^Corporate registry/ }),
  ).toHaveAttribute(
    "href",
    "https://www.houjin-bangou.nta.go.jp/en/henkorireki-johoto.html?selHouzinNo=0000000000000",
  );
});
