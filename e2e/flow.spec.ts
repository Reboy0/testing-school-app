/**
 * OpenCards suite «Наскрізні сценарії» (prefix FLOW): whole customer journeys
 * through the real browser, API and database, each starting from a brand-new
 * visitor and leaving nothing behind (see fixtures.ts).
 */
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { card, cartLink, cartRow, cartTotals, header, signInThroughForm, uniqueEmail, waitForProducts } from "./plan-helpers";

async function register(page: Page, email: string, name: string) {
  await page.goto("/register");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Password").fill("Abcdefghi1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  await expect(header(page).getByRole("link", { name })).toBeVisible();
}

async function findAndAdd(page: Page, search: string, product: string) {
  await header(page).getByRole("link", { name: "Catalogue" }).click();
  await expect(page).toHaveURL("/catalogue");
  await waitForProducts(page);
  await page.getByLabel("Search").fill(search);
  const item = card(page, product);
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Add to cart" }).click();
  await expect(item.getByText(/In your cart: \d+/)).toBeVisible();
}

test("FLOW-01: register → search for a product → add it to the cart → change the quantity → sign out and back in → the cart is still there", async ({ page }) => {
  const email = uniqueEmail("flow-buyer");
  await register(page, email, "Flow Buyer");

  await findAndAdd(page, "lamp", "Desk lamp");
  await expect(cartLink(page)).toHaveText("Cart (1)");

  await cartLink(page).click();
  await expect(page).toHaveURL("/cart");
  await cartRow(page, "Desk lamp").getByRole("button", { name: "Add one more Desk lamp" }).click();
  await expect(cartLink(page)).toHaveText("Cart (2)");
  // 2 × 34.50 = 69.00, not on sale.
  expect(await cartTotals(page)).toEqual({ Subtotal: "$69.00", Total: "$69.00" });

  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(cartLink(page)).toHaveText("Cart (0)");

  await page.goto("/login");
  await signInThroughForm(page, { email, password: "Abcdefghi1" });
  await expect(page).toHaveURL("/");
  await cartLink(page).click();
  await expect(cartLink(page)).toHaveText("Cart (2)");
  expect((await cartTotals(page)).Total).toBe("$69.00");
});

test("FLOW-02: a guest fills a cart, then registers — the account starts with everything the guest chose", async ({ page }) => {
  await page.goto("/");
  await findAndAdd(page, "lamp", "Desk lamp");
  await findAndAdd(page, "cable", "USB-C cable");
  await expect(cartLink(page)).toHaveText("Cart (2)");

  await register(page, uniqueEmail("flow-guest"), "Flow Guest");

  await cartLink(page).click();
  await expect(cartRow(page, "Desk lamp")).toBeVisible();
  await expect(cartRow(page, "USB-C cable")).toBeVisible();
  // 34.50 + 8.99 = 43.49.
  expect((await cartTotals(page)).Total).toBe("$43.49");
});

test("FLOW-03: register → search → add to cart → place the order", async ({ page }) => {
  test.fail(true, "Known gap: the application has no checkout or orders, and docs/spec.md does not specify one (OQ FLOW-OQ-01).");

  await register(page, uniqueEmail("flow-order"), "Flow Order");
  await findAndAdd(page, "dock", "iPhone dock");
  await cartLink(page).click();

  await page.getByRole("button", { name: /checkout|place order/i }).click({ timeout: 3000 });
  await expect(page.getByText(/order (placed|confirmed)/i)).toBeVisible();
});
