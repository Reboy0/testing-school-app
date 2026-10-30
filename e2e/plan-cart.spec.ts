/**
 * End-to-end cases E-CART-01 … E-CART-06 from docs/test-plan.md §6.4, with
 * seeded products: iPhone dock (19.99, 25 % off) and Desk lamp (34.50).
 */
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { API_URL, card, cartLink, cartRow, cartTotals, createAccount, header, signIn, signInThroughForm, waitForProducts } from "./plan-helpers";

async function addFromCatalogue(page: Page, name: string) {
  await page.goto("/catalogue");
  await page.getByLabel("Search").fill(name);
  await waitForProducts(page);
  const item = card(page, name);
  await item.getByRole("button", { name: "Add to cart" }).click();
  await expect(item.getByRole("button", { name: "Add to cart" })).toBeEnabled();
}

const quantityOf = (page: Page, name: string) => cartRow(page, name).locator("span.min-w-4");

test("CRT-01 E-CART-01: a guest's cart is still there after a reload and after closing and reopening the page", async ({ context, page }) => {
  await addFromCatalogue(page, "Desk lamp");
  await expect(cartLink(page)).toHaveText("Cart (1)");

  await page.reload();
  await expect(cartLink(page)).toHaveText("Cart (1)");

  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/cart");
  await expect(cartRow(reopened, "Desk lamp")).toBeVisible();
  await expect(cartLink(reopened)).toHaveText("Cart (1)");
});

test("CRT-04 E-CART-02: adding the same product twice gives one line of 2, and the card says 2 are in the cart", async ({ page }) => {
  await addFromCatalogue(page, "Desk lamp");
  await card(page, "Desk lamp").getByRole("button", { name: "Add to cart" }).click();
  await expect(card(page, "Desk lamp").getByText("In your cart: 2")).toBeVisible();

  await page.goto("/cart");
  await expect(cartRow(page, "Desk lamp")).toHaveCount(1);
  await expect(quantityOf(page, "Desk lamp")).toHaveText("2");
});

test("CRT-05 E-CART-03: on /cart, increasing, decreasing and deleting a line keep the totals and the badge right after every step", async ({ page }) => {
  await addFromCatalogue(page, "Desk lamp");
  await page.goto("/cart");
  const row = cartRow(page, "Desk lamp");

  await row.getByRole("button", { name: "Add one more Desk lamp" }).click();
  await expect(quantityOf(page, "Desk lamp")).toHaveText("2");
  await expect(cartLink(page)).toHaveText("Cart (2)");
  expect((await cartTotals(page)).Total).toBe("$69.00");

  await row.getByRole("button", { name: "Remove one Desk lamp" }).click();
  await expect(quantityOf(page, "Desk lamp")).toHaveText("1");
  await expect(cartLink(page)).toHaveText("Cart (1)");
  expect((await cartTotals(page)).Total).toBe("$34.50");

  await row.getByRole("button", { name: "Remove Desk lamp from the cart" }).click();
  await expect(page.getByText("Your cart is empty")).toBeVisible();
  await expect(cartLink(page)).toHaveText("Cart (0)");
});

test("CRT-06 E-CART-04: a guest's cart is merged into an account that already has one: quantities add up and nothing is lost", async ({ page, playwright }) => {
  const accountApi = await playwright.request.newContext();
  const account = await createAccount(accountApi, "merge");
  const products = (await (await accountApi.get(`${API_URL}/products?q=desk%20lamp`)).json()).items;
  const docks = (await (await accountApi.get(`${API_URL}/products?q=iphone%20dock`)).json()).items;
  await accountApi.post(`${API_URL}/cart/items`, { data: { productId: products[0].id, quantity: 1 } });
  await accountApi.dispose();

  await addFromCatalogue(page, "Desk lamp");
  await card(page, "Desk lamp").getByRole("button", { name: "Add to cart" }).click();
  await expect(cartLink(page)).toHaveText("Cart (2)");
  await page.goto("/catalogue");
  await page.getByLabel("Search").fill("iPhone dock");
  await card(page, docks[0].name).getByRole("button", { name: "Add to cart" }).click();
  await expect(cartLink(page)).toHaveText("Cart (3)");

  await page.goto("/login");
  await signInThroughForm(page, account);
  await expect(page).toHaveURL("/");
  await page.goto("/cart");

  await expect(cartLink(page)).toHaveText("Cart (4)");
  const lampQuantities = await cartRow(page, "Desk lamp").locator("span.min-w-4").allTextContents();
  expect(lampQuantities.reduce((sum, quantity) => sum + Number(quantity), 0)).toBe(3);
  await expect(quantityOf(page, "iPhone dock")).toHaveText("1");
});

test("CRT-07 E-CART-05: iPhone dock (19.99, 25 % off) × 3 shows a total of 59.97, a discount of 14.99 and 44.98 to pay", async ({ page }) => {
  await addFromCatalogue(page, "iPhone dock");
  await page.goto("/cart");
  const row = cartRow(page, "iPhone dock");
  await row.getByRole("button", { name: "Add one more iPhone dock" }).click();
  await expect(quantityOf(page, "iPhone dock")).toHaveText("2");
  await row.getByRole("button", { name: "Add one more iPhone dock" }).click();
  await expect(quantityOf(page, "iPhone dock")).toHaveText("3");

  // 3 × 19.99 = 59.97; 25 % of 59.97 = 14.9925 → 14.99; 59.97 − 14.99 = 44.98.
  expect(await cartTotals(page)).toEqual({ Subtotal: "$59.97", Discount: "$14.99", Total: "$44.98" });
  await expect(row).toContainText("$44.98");
});

test("CRT-11 E-CART-06: after signing out, the signed-in user's cart is no longer shown", async ({ page, request }) => {
  const account = await createAccount(request, "cartout");
  await signIn(page, account);
  await addFromCatalogue(page, "Desk lamp");
  await expect(cartLink(page)).toHaveText("Cart (1)");

  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Login" })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty")).toBeVisible();
  await expect(cartLink(page)).toHaveText("Cart (0)");
});
