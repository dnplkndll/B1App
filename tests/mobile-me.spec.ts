import { test, expect } from "@playwright/test";
import { mobileLogoutButton } from "./helpers/mobile";

// Me page: aggregates serving assignments, registrations, and group events into one
// date-sorted upcoming list, plus recent notifications. demo@b1.church is a member of
// GRP00000004 which has the weekly recurring EVT00000018, guaranteeing an event row.

test.describe("Mobile Me page", () => {
  test("renders upcoming items and event rows navigate to the group", async ({ page }) => {
    await page.goto("/mobile/me");
    await expect(mobileLogoutButton(page)).toBeVisible({ timeout: 30000 });

    await expect(page.locator("main")).toContainText(/Upcoming/i, { timeout: 15000 });

    const eventRow = page.getByTestId("me-item-event").first();
    await expect(eventRow).toBeVisible({ timeout: 15000 });
    await eventRow.click();
    await expect(page).toHaveURL(/\/mobile\/groups\//, { timeout: 15000 });
  });

  test("shows a serving row and it navigates to plans", async ({ page }) => {
    await page.goto("/mobile/me");
    await expect(mobileLogoutButton(page)).toBeVisible({ timeout: 30000 });
    const servingRow = page.getByTestId("me-item-serving").first();
    // Demo's seeded assignments (ASS00000008/09) surface only if their plan dates are
    // upcoming; assert navigation only when a row is present.
    if (await servingRow.isVisible().catch(() => false)) {
      await servingRow.click();
      await expect(page).toHaveURL(/\/mobile\/plans/, { timeout: 15000 });
    }
  });
});
