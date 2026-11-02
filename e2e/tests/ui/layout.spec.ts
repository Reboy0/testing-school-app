/**
 * Responsive layout (suite XC, plan row UI-RESP-01).
 */
import { expect, test } from "../../fixture/test";
import { settle } from "../../utils/a11y";

const WIDTHS = [375, 768, 1280];
const PAGES = ["/", "/catalogue", "/cart", "/profile"];

test("XC-023 UI-RESP-01: /, /catalogue, /cart and /profile have no horizontal scroll at 375, 768 and 1280 px, and keep the header, cart badge and theme toggle", async ({ app, page }) => {
  const problems: string[] = [];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await settle(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) problems.push(`${path} at ${width}px scrolls sideways by ${overflow}px`);
      for (const [what, locator] of app.header.landmarks()) {
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
