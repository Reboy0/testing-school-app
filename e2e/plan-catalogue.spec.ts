/**
 * End-to-end cases E-CAT-01 … E-CAT-06 from docs/test-plan.md §6.3, against
 * the seeded catalogue (61 products, 5 categories).
 */
import { expect, test } from "./fixtures";
import { allProductsFromApi, API_URL, cardNames, cards, listPricesCents, pageIndicator, waitForProducts } from "./plan-helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/catalogue");
  await waitForProducts(page);
});

test("SEARCH-003 E-CAT-01: a search on /catalogue shows only products whose names contain it", async ({ page }) => {
  await page.getByLabel("Search").fill("DESK");

  await expect(cards(page).first()).toBeVisible();
  await expect.poll(async () => (await cardNames(page)).every((name) => name.toLowerCase().includes("desk"))).toBe(true);
  const names = await cardNames(page);
  expect(names.length).toBeGreaterThan(0);
});

test("SEARCH-013 E-CAT-02: with a category and a price range, every product shown meets both and none that does is missing", async ({ page, request }) => {
  // The expectation is built from the category filter alone, priced by hand
  // here, so it does not lean on the combined filter under test.
  const expected = (await allProductsFromApi(request, "category=furniture"))
    .filter((product) => product.priceCents >= 3000 && product.priceCents <= 20000)
    .map((product) => product.name)
    .sort();
  expect(expected.length).toBeGreaterThan(0);

  await page.getByLabel("Category").selectOption("furniture");
  await page.getByLabel("Lowest price (cents)").fill("3000");
  await page.getByLabel("Highest price (cents)").fill("20000");

  await expect.poll(async () => (await cardNames(page)).sort()).toEqual(expected);
});

test("SORT-004 E-CAT-03: sorting by price puts the prices on the page in order, both ways", async ({ page }) => {
  await page.getByLabel("Sort by").selectOption("price_asc");
  await expect.poll(async () => {
    const prices = await listPricesCents(page);
    return prices.length > 1 && prices.every((price, index) => index === 0 || prices[index - 1] <= price);
  }).toBe(true);

  await page.getByLabel("Sort by").selectOption("price_desc");
  await expect.poll(async () => {
    const prices = await listPricesCents(page);
    return prices.length > 1 && prices.every((price, index) => index === 0 || prices[index - 1] >= price);
  }).toBe(true);
});

test("SORT-019 E-CAT-04: the last page can be reached and has products on it, so every product is on some page", async ({ page, request }) => {
  const { total } = await (await request.get(`${API_URL}/products`)).json();
  const seen = new Set(await cardNames(page));

  while (await page.getByRole("button", { name: "Next", exact: true }).isEnabled()) {
    const before = await pageIndicator(page).textContent();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(pageIndicator(page)).not.toHaveText(before ?? "");
    for (const name of await cardNames(page)) seen.add(name);
  }

  await expect(cards(page).first()).toBeVisible();
  expect(seen.size).toBe(total);
});

test("SEARCH-022 E-CAT-05: changing a filter on page 2 goes back to page 1", async ({ page }) => {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pageIndicator(page)).toHaveText(/^Page 2 of/);

  await page.getByLabel("Sort by").selectOption("price_desc");

  await expect(pageIndicator(page)).toHaveText(/^Page 1 of/);
});

test("CATL-015 E-CAT-06: on a slow network the catalogue shows it is loading and never flashes No products found", async ({ page }) => {
  await page.route("**/products?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  const sawNothingFound: boolean[] = [];
  page.on("console", () => {});
  await page.exposeFunction("reportNothingFound", () => sawNothingFound.push(true));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.body?.innerText.includes("No products found")) (window as unknown as { reportNothingFound(): void }).reportNothingFound();
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });

  await page.goto("/catalogue");

  await expect(page.getByRole("main").getByText("Loading…")).toBeVisible();
  await waitForProducts(page);
  expect(sawNothingFound).toEqual([]);
});
