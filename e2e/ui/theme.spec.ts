/**
 * UI cases UI-THEME-01 … UI-THEME-06 from docs/test-plan.md §6.6.
 * The theme in force is read off the page background: the canvas token is
 * white in the light theme and rgb(2, 6, 23) in the dark one.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import type { Page } from "@playwright/test";
import { createAccount, header } from "../plan-helpers";

const LIGHT = "rgb(255, 255, 255)";
const DARK = "rgb(2, 6, 23)";

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const toggle = (page: Page) => header(page).getByRole("button", { name: /Switch to the (dark|light) theme/ });

for (const [scheme, expected] of [["dark", DARK], ["light", LIGHT]] as const) {
  test(`TH-01 UI-THEME-01: with nothing stored, the page follows a ${scheme} operating-system scheme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");

    expect(await background(page)).toBe(expected);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
  });
}

test("TH-01 UI-THEME-02: the header offers the theme toggle to a guest and to a signed-in user", async ({ page }) => {
  await page.goto("/");
  await expect(toggle(page)).toBeVisible();

  await createAccount(page.request, "themetoggle");
  await page.reload();
  await expect(header(page).getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(toggle(page)).toBeVisible();
});

for (const [system, chosen, expected] of [
  ["light", "dark", DARK],
  ["dark", "light", LIGHT],
] as const) {
  const id = system === "light" ? "TH-02 UI-THEME-03" : "TH-02 UI-THEME-04";
  test(`${id}: on a ${system} system, choosing ${chosen} holds across navigation, a reload and a new page`, async ({ context, page }) => {
    await page.emulateMedia({ colorScheme: system });
    await page.goto("/");
    await header(page).getByRole("button", { name: `Switch to the ${chosen} theme` }).click();
    expect(await background(page)).toBe(expected);

    await header(page).getByRole("link", { name: "Catalogue" }).click();
    await expect(page).toHaveURL("/catalogue");
    expect(await background(page)).toBe(expected);

    await page.reload();
    expect(await background(page)).toBe(expected);

    const later = await context.newPage();
    await later.emulateMedia({ colorScheme: system });
    await later.goto("/login");
    expect(await background(later)).toBe(expected);
  });
}

test("TH-03 UI-THEME-05: a stored dark theme is applied before the first paint on a light system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    window.localStorage.setItem("theme", "dark");
    // Records the theme the instant the body element exists — before
    // anything inside it can have been painted.
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      (window as unknown as { themeAtBody?: string }).themeAtBody = document.documentElement.dataset.theme ?? "none";
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto("/catalogue");

  expect(await page.evaluate(() => (window as unknown as { themeAtBody?: string }).themeAtBody)).toBe("dark");
  expect(await background(page)).toBe(DARK);
});

for (const theme of ["light", "dark"] as const) {
  test(`TH-04 UI-THEME-06: key pages pass axe's colour-contrast check in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
    const violations: string[] = [];

    for (const path of ["/", "/catalogue", "/cart", "/login", "/register", "/forgot-password"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      for (const violation of result.violations) {
        for (const node of violation.nodes) violations.push(`${path}: ${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1]?.trim()}`);
      }
    }

    expect(violations).toEqual([]);
  });
}
