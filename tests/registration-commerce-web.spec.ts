import { test, expect, type Page } from "@playwright/test";

// Public web registration wizard (grace.localtest.me/register/<eventId>). Exercises
// the shared wizard hook + pricing + coupon end to end as a guest, up to the payment
// step. The actual guest card charge is NOT completed here: the guest paid submit is
// left for a manual pass (mirrors the reCAPTCHA-gated guest donation flow), so this
// asserts the order-summary total and the discount math, which is where the client
// pricing wiring lives. Member paid charges are covered in
// mobile-registration-commerce.spec.ts.

const VBS = "EVT00000015";
const TSHIRT = "RGS00000001";

// Typing into the SSR'd inputs before React hydrates silently loses the value (see
// registration.spec.ts). The count fetch fires from a useEffect — strictly
// post-hydration — so gate on it before touching the form.
async function gotoWizard(page: Page, eventId: string) {
  const countResp = page.waitForResponse((r) => r.url().includes(`/registrations/event/${eventId}/count`), { timeout: 30000 });
  await page.goto(`/register/${eventId}`);
  await countResp;
}

test.describe("Public web registration wizard (guest)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("guest reaches payment with correct total, coupon discounts it", async ({ page }) => {
    await gotoWizard(page, VBS);
    const main = page.locator("main");

    // Info step: guest contact + primary attendee type.
    const first = main.getByLabel("First Name");
    await expect(async () => {
      await first.fill("Web");
      await expect(first).toHaveValue("Web", { timeout: 1000 });
    }).toPass({ timeout: 20000 });
    await main.getByLabel("Last Name").fill("Guest");
    await main.getByLabel("Email").fill(`webguest+${Date.now()}@example.com`);
    await page.getByTestId("primary-type").click();
    await page.getByRole("option", { name: /Chaperone/i }).click();
    await main.getByRole("button", { name: /^Continue$/i }).click();

    // Members step (no extras) -> selections.
    await expect(main.getByText("Additional Members")).toBeVisible({ timeout: 10000 });
    await main.getByRole("button", { name: /Continue/i }).click();

    // Selections: add one T-shirt.
    await page.getByTestId("sel-add-" + TSHIRT).click();
    await expect(page.getByTestId("sel-qty-" + TSHIRT)).toHaveText("1");
    await main.getByRole("button", { name: /Continue/i }).click();

    // Payment step: Chaperone $15 + T-shirt $12 = $27.
    await expect(page.getByTestId("reg-total")).toHaveText("$27.00", { timeout: 25000 });

    // Coupon: 10% off -> $24.30.
    await page.getByTestId("reg-coupon-input").locator("input").fill("EARLYBIRD");
    await page.getByTestId("reg-coupon-apply").click();
    await expect(page.getByTestId("reg-total")).toHaveText("$24.30", { timeout: 15000 });

    // Provider card entry rendered (Stripe CardElement iframe present).
    await expect(page.locator('iframe[title="Secure card payment input frame"]')).toBeVisible({ timeout: 20000 });
  });
});
