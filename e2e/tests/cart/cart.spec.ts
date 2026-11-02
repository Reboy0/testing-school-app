/**
 * The cart (suite CRT, plan rows E-CART-01…06), with seeded products:
 * iPhone dock (19.99, 25 % off) and Desk lamp (34.50).
 */
import { Application } from "../../app";
import { expect, test } from "../../fixture/test";
import { PRODUCTS } from "../../data";
import { getCartLines } from "../../db";
import { Tag } from "../../tags";

const LAMP = PRODUCTS.deskLamp.name;
const DOCK = PRODUCTS.iphoneDock.name;

test("CRT-003 E-CART-01: a guest's cart is still there after a reload and after closing and reopening the page", { tag: Tag.Smoke }, async ({ unauthorizedUserApp: app, context, page }) => {
  await app.catalogue.addToCart(LAMP);
  await app.header.expectCartCount(1);

  await app.catalogue.reload();
  await app.header.expectCartCount(1);

  await page.close();
  const reopened = new Application(await context.newPage());
  await reopened.cart.open();
  await reopened.cart.expectLine(LAMP);
  await reopened.header.expectCartCount(1);
});

test("CRT-009 E-CART-02: adding the same product twice gives one line of 2, and the card says 2 are in the cart", async ({ unauthorizedUserApp: app }) => {
  await app.catalogue.addToCart(LAMP);
  await app.catalogue.products.addToCart(LAMP);
  await app.catalogue.products.expectInCart(LAMP, 2);

  await app.cart.open();
  await app.cart.expectLineCount(LAMP, 1);
  await app.cart.expectQuantity(LAMP, 2);
});

test("CRT-015 E-CART-03: on /cart, increasing, decreasing and deleting a line keep the totals and the badge right after every step", async ({ unauthorizedUserApp: app }) => {
  await app.catalogue.addToCart(LAMP);
  await app.cart.open();

  await app.cart.increase(LAMP, 2);
  await app.header.expectCartCount(2);
  await app.cart.expectTotal("$69.00");

  await app.cart.decrease(LAMP, 1);
  await app.header.expectCartCount(1);
  await app.cart.expectTotal("$34.50");

  await app.cart.remove(LAMP);
  await app.cart.expectEmpty();
  await app.header.expectCartCount(0);
});

test("CRT-020 E-CART-04: a guest's cart is merged into an account that already has one: quantities add up and nothing is lost", async ({ unauthorizedUserApp: app, createdUser, api, db }) => {
  // createdUser's API context is signed in as that account: its cart holds one lamp.
  await api.addToCart((await api.findProduct(LAMP)).id, 1);

  await app.catalogue.addToCart(LAMP);
  await app.catalogue.products.addToCart(LAMP);
  await app.header.expectCartCount(2);
  await app.catalogue.products.search(DOCK);
  await app.catalogue.products.addToCart(DOCK);
  await app.header.expectCartCount(3);

  await app.signIn.open();
  await app.signIn.signIn(createdUser);
  await app.home.expectLoaded();
  await app.cart.open();

  await app.header.expectCartCount(4);
  expect(await app.cart.totalQuantityOf(LAMP)).toBe(3);
  await app.cart.expectQuantity(DOCK, 1);
  expect(await getCartLines(db, createdUser.email)).toEqual([
    { name: LAMP, quantity: 3 },
    { name: DOCK, quantity: 1 },
  ]);
});

test("CRT-026 E-CART-05: iPhone dock (19.99, 25 % off) × 3 shows a total of 59.97, a discount of 14.99 and 44.98 to pay", async ({ unauthorizedUserApp: app }) => {
  await app.catalogue.addToCart(DOCK);
  await app.cart.open();
  await app.cart.increase(DOCK, 2);
  await app.cart.increase(DOCK, 3);

  // 3 × 19.99 = 59.97; 25 % of 59.97 = 14.9925 → 14.99; 59.97 − 14.99 = 44.98.
  await app.cart.expectTotals({ Subtotal: "$59.97", Discount: "$14.99", Total: "$44.98" });
  await app.cart.expectLineText(DOCK, "$44.98");
});

test("CRT-035 E-CART-06: after signing out, the signed-in user's cart is no longer shown", async ({ app }) => {
  await app.catalogue.addToCart(LAMP);
  await app.header.expectCartCount(1);

  await app.header.signOut();

  await app.cart.open();
  await app.cart.expectEmpty();
  await app.header.expectCartCount(0);
});
