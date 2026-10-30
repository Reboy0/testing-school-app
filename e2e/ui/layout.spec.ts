/**
 * UI cases UI-RESP-01 and UI-VIS-01 from docs/test-plan.md §6.7.
 *
 * UI-VIS-01 compares against baselines in ui/layout.spec.ts-snapshots/. A
 * baseline is only ever replaced on purpose, after a change has been looked
 * at and approved: `pnpm --filter @school/e2e test ui/layout --update-snapshots`.
 */
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";
import { cartLink, createAccount, header } from "../plan-helpers";

const WIDTHS = [375, 768, 1280];

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("XC-08 UI-RESP-01: /, /catalogue, /cart and /profile have no horizontal scroll at 375, 768 and 1280 px, and keep the header, cart badge and theme toggle", async ({ page }) => {
  await createAccount(page.request, "responsive");
  const problems: string[] = [];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/catalogue", "/cart", "/profile"]) {
      await open(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${path} at ${width}px scrolls sideways by ${overflow}px`);
      for (const [what, locator] of [
        ["header", header(page)],
        ["cart badge", cartLink(page)],
        ["theme toggle", header(page).getByRole("button", { name: /Switch to the/ })],
      ] as const) {
        if (!(await locator.isVisible())) problems.push(`${path} at ${width}px: the ${what} is not visible`);
        else if (!(await locator.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return box.left >= 0 && box.right <= window.innerWidth;
        }))) problems.push(`${path} at ${width}px: the ${what} is cut off`);
      }
    }
  }

  expect(problems).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  for (const [device, width] of [["desktop", 1280], ["mobile", 375]] as const) {
    test(`XC-09 UI-VIS-01: key pages look as approved — ${theme}, ${device}`, async ({ page }) => {
      await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
      await page.setViewportSize({ width, height: 900 });

      for (const path of ["/login", "/register", "/forgot-password", "/cart"]) {
        await open(page, path);
        await expect(page).toHaveScreenshot(`${theme}-${device}${path.replace(/\//g, "-")}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.01,
        });
      }
    });
  }
}
