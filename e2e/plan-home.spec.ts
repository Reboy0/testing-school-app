/**
 * End-to-end cases E-HOME-01 … E-HOME-03 from docs/test-plan.md §6.5.
 */
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { cardNames, createAccount, pageIndicator, signIn, waitForProducts } from "./plan-helpers";

test("HP-002 E-HOME-01: a guest on / follows the sign-in and registration links to /login and /register", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL("/register");
});

test("HP-004 E-HOME-02: a signed-in user on / is greeted by name, and the link goes to /profile", async ({ page, request }) => {
  const account = await createAccount(request, "home");
  await signIn(page, account);

  await expect(page.getByRole("heading", { name: `Welcome back, ${account.name}` })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Your profile" }).click();
  await expect(page).toHaveURL("/profile");
});

test("HP-008 E-HOME-03: search, filter, sort and paging on / behave like /catalogue and show the same products", async ({ page }) => {
  async function browse(path: string): Promise<{ names: string[]; indicator: string | null }> {
    await page.goto(path);
    await waitForProducts(page);
    await page.getByLabel("Search").fill("e");
    await page.getByLabel("Sort by").selectOption("price_desc");
    await expect(pageIndicator(page)).toHaveText(/^Page 1 of/);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(pageIndicator(page)).toHaveText(/^Page 2 of/);
    return { names: await cardNames(page), indicator: await pageIndicator(page).textContent() };
  }

  const home = await browse("/");
  const catalogue = await browse("/catalogue");

  expect(home.names.length).toBeGreaterThan(0);
  expect(home).toEqual(catalogue);
});

export type { Page };
