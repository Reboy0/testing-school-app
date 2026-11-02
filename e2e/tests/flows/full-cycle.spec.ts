/**
 * Whole customer journeys (suite FLOW): the real browser, API and database,
 * each starting from a brand-new visitor and leaving nothing behind.
 */
import { expect, test } from "../../fixture/test";
import type { Application } from "../../app";
import { PRODUCTS } from "../../data";
import { getCartLines, getUserByEmail } from "../../db";
import { Tag } from "../../tags";

const LAMP = PRODUCTS.deskLamp;

async function findAndAdd(app: Application, product: { name: string; search: string }) {
  await app.header.openCatalogue();
  await app.catalogue.expectLoaded();
  await app.catalogue.products.search(product.search);
  await app.catalogue.products.addToCart(product.name);
  await app.catalogue.products.expectCardText(product.name, /In your cart: \d+/);
}

test("FLOW-01: register → search for a product → add it to the cart → change the quantity → sign out and back in → the cart is still there", { tag: Tag.Smoke }, async ({ unauthorizedUserApp: app, testData, db }) => {
  const user = testData.user("flow-buyer");
  await app.register.open();
  await app.register.register(user);
  await app.header.expectSignedInAs(user.name);
  await expect.poll(async () => (await getUserByEmail(db, user.email))?.name).toBe(user.name);

  await findAndAdd(app, LAMP);
  await app.header.expectCartCount(1);

  await app.header.openCart();
  await app.cart.expectLoaded();
  await app.cart.increase(LAMP.name, 2);
  await app.header.expectCartCount(2);
  // 2 × 34.50 = 69.00, not on sale.
  await app.cart.expectTotals({ Subtotal: "$69.00", Total: "$69.00" });

  await app.header.signOut();
  await app.header.expectCartCount(0);

  await app.signIn.open();
  await app.signIn.signIn(user);
  await app.home.expectLoaded();
  await app.header.openCart();
  await app.header.expectCartCount(2);
  await app.cart.expectTotal("$69.00");
  expect(await getCartLines(db, user.email)).toEqual([{ name: LAMP.name, quantity: 2 }]);
});

test("FLOW-02: a guest fills a cart, then registers — the account starts with everything the guest chose", async ({ unauthorizedUserApp: app, testData }) => {
  await app.home.open();
  await findAndAdd(app, LAMP);
  await findAndAdd(app, PRODUCTS.usbCable);
  await app.header.expectCartCount(2);

  await app.register.open();
  await app.register.register(testData.user("flow-guest"));

  await app.header.openCart();
  await app.cart.expectLine(LAMP.name);
  await app.cart.expectLine(PRODUCTS.usbCable.name);
  // 34.50 + 8.99 = 43.49.
  await app.cart.expectTotal("$43.49");
});

test("FLOW-03: register → search → add to cart → place the order", async ({ unauthorizedUserApp: app, testData }) => {
  test.fail(true, "Known gap: the application has no checkout or orders, and docs/spec.md does not specify one (OQ FLOW-OQ-01).");

  await app.register.open();
  await app.register.register(testData.user("flow-order"));
  await findAndAdd(app, PRODUCTS.iphoneDock);
  await app.header.openCart();

  await app.cart.checkout();
  await app.cart.expectOrderConfirmed();
});
