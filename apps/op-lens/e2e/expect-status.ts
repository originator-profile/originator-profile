import { expect, Page } from "@playwright/test";

export async function expectStatus(
  ext: Page,
  label: string,
  expected: "check" | "cancel" | "null",
) {
  const item = ext.getByTestId(`result-${label}`);
  await expect(item.getByTestId(`status-${expected}`)).toBeVisible();
}
