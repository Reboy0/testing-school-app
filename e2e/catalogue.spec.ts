import { expect, test } from "@playwright/test";

// Seeded: "Desk lamp" costs 3450 cents and is not on sale, so the price the
// catalogue shows, the price the cart shows and the total are all $34.50.
const PRODUCT = "Desk lamp";

test("CATL-046: browse the catalogue and put something in the cart", async ({ page }) => {
  await page.goto("/catalogue");
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();

  await page.getByLabel("Search").fill(PRODUCT);

  const card = page.getByRole("listitem").filter({ hasText: PRODUCT });
  await expect(card).toBeVisible();
  await expect(card.getByText("$34.50")).toBeVisible();

  await card.getByRole("button", { name: "Add to cart" }).click();
  await expect(card.getByText("In your cart: 1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart (1)" })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: PRODUCT })).toBeVisible();
  await expect(page.getByText("$34.50").first()).toBeVisible();
});
