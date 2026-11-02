/**
 * Browsing the catalogue (suites SEARCH, SORT, CATL; plan rows E-CAT-01…06
 * and the legacy check CATL-046), against the seeded catalogue.
 */
import { expect, test } from "../../fixture/test";
import { PRODUCTS } from "../../data";
import { Tag } from "../../tags";

test.beforeEach(async ({ unauthorizedUserApp: app }) => {
  await app.catalogue.open();
});

test("SEARCH-003 E-CAT-01: a search on /catalogue shows only products whose names contain it", { tag: Tag.Smoke }, async ({ unauthorizedUserApp: { catalogue } }) => {
  await catalogue.products.search("DESK");

  await catalogue.products.expectSomeProducts();
  await catalogue.products.expectEveryName((name) => name.toLowerCase().includes("desk"));
});

test("SEARCH-013 E-CAT-02: with a category and a price range, every product shown meets both and none that does is missing", async ({ unauthorizedUserApp: { catalogue }, api }) => {
  // The expectation is built from the category filter alone, priced by hand
  // here, so it does not lean on the combined filter under test.
  const expected = (await api.allProducts("category=furniture"))
    .filter((product) => product.priceCents >= 3000 && product.priceCents <= 20000)
    .map((product) => product.name);
  expect(expected.length).toBeGreaterThan(0);

  await catalogue.products.chooseCategory("furniture");
  await catalogue.products.setPriceRange("3000", "20000");

  await catalogue.products.expectNames(expected);
});

test("SORT-004 E-CAT-03: sorting by price puts the prices on the page in order, both ways", async ({ unauthorizedUserApp: { catalogue } }) => {
  await catalogue.products.sortBy("price_asc");
  await catalogue.products.expectPricesSorted("asc");

  await catalogue.products.sortBy("price_desc");
  await catalogue.products.expectPricesSorted("desc");
});

test("SORT-019 E-CAT-04: the last page can be reached and has products on it, so every product is on some page", async ({ unauthorizedUserApp: { catalogue }, api }) => {
  const total = await api.productCount();
  const seen = new Set(await catalogue.products.cardNames());

  while (await catalogue.products.hasNextPage()) {
    await catalogue.products.nextPage();
    for (const name of await catalogue.products.cardNames()) seen.add(name);
  }

  await catalogue.products.expectSomeProducts();
  expect(seen.size).toBe(total);
});

test("SEARCH-022 E-CAT-05: changing a filter on page 2 goes back to page 1", async ({ unauthorizedUserApp: { catalogue } }) => {
  await catalogue.products.nextPage();
  await catalogue.products.expectOnPage(2);

  await catalogue.products.sortBy("price_desc");

  await catalogue.products.expectOnPage(1);
});

test("CATL-015 E-CAT-06: on a slow network the catalogue shows it is loading and never flashes No products found", async ({ unauthorizedUserApp: { catalogue } }) => {
  await catalogue.slowDownProducts(1500);
  const sawNothingFound = await catalogue.recordNothingFound();

  await catalogue.visit();

  await catalogue.products.expectLoading();
  await catalogue.products.expectProductsLoaded();
  expect(sawNothingFound).toEqual([]);
});

test("CATL-046: browse the catalogue and put something in the cart", async ({ unauthorizedUserApp: app }) => {
  const lamp = PRODUCTS.deskLamp;
  await app.catalogue.products.search(lamp.name);
  await app.catalogue.products.expectCardText(lamp.name, lamp.price);

  await app.catalogue.products.addToCart(lamp.name);
  await app.catalogue.products.expectInCart(lamp.name, 1);
  await app.header.expectCartCount(1);

  await app.cart.open();
  await app.cart.expectLine(lamp.name);
  await app.cart.expectLineText(lamp.name, lamp.price);
});
