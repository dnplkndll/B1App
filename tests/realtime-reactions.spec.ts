import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { waitForRoomJoin } from "./helpers/realtime";

// Chat reactions live cross-user. GRP00000004 has a seeded group conversation
// (CVS00000006, 2 messages). Both users open the chat and join its room; tester
// reacts and demo sees the chip appear without reload (SocketHelper "reaction").

const GROUP_ID = "GRP00000004";

async function loginAs(page: Page, email: string) {
  await page.goto("/login", { timeout: 60000 });
  await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 30000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "password");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
}

async function openChat(page: Page) {
  const joined = waitForRoomJoin(page);
  await page.goto(`/mobile/groups/${GROUP_ID}`, { timeout: 60000 });
  await page.getByRole("tab", { name: /Messages/i }).click();
  // The chat modal renders message add-reaction buttons once messages load.
  await page.locator('[data-testid^="react-add-"]').first().waitFor({ state: "visible", timeout: 30000 });
  await joined;
}

test.describe("Realtime — chat reactions", () => {
  test.describe.configure({ mode: "serial" });

  let demoContext: BrowserContext;
  let testerContext: BrowserContext;
  let demoPage: Page;
  let testerPage: Page;

  test.beforeAll(async ({ browser }) => {
    demoContext = await browser.newContext({ storageState: undefined });
    testerContext = await browser.newContext({ storageState: undefined });
    demoPage = await demoContext.newPage();
    testerPage = await testerContext.newPage();
    await Promise.all([loginAs(demoPage, "demo@b1.church"), loginAs(testerPage, "tester@b1.church")]);
  });

  test.afterAll(async () => {
    await demoContext?.close();
    await testerContext?.close();
  });

  test("tester's reaction appears on demo's tab live, and toggling off removes it", async () => {
    await Promise.all([openChat(demoPage), openChat(testerPage)]);

    // Tester reacts thumbs-up on the last message.
    await testerPage.locator('[data-testid^="react-add-"]').last().click();
    await testerPage.getByTestId("react-emoji-👍").click();

    // Tester sees its own chip (optimistic from POST response).
    await expect(testerPage.getByTestId("reaction-chip-👍").last()).toBeVisible({ timeout: 10000 });

    // Demo sees the chip appear live via the socket broadcast — no reload.
    await expect(demoPage.getByTestId("reaction-chip-👍").last()).toBeVisible({ timeout: 15000 });

    // Toggle off: tester removes the reaction; demo's chip disappears live.
    await testerPage.getByTestId("reaction-chip-👍").last().click();
    await expect(demoPage.getByTestId("reaction-chip-👍")).toHaveCount(0, { timeout: 15000 });
  });
});
