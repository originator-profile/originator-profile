import { expect, Page } from "@playwright/test";

export async function gotoDetailPage(ext: Page) {
  await ext.getByTestId("global-header-menu-button").click();
  await ext.getByTestId("detail-info-menu-item").click();
  await expect(ext).toHaveURL(/detail/);
  await expect(ext.getByTestId("verification-results")).toBeVisible();
}
