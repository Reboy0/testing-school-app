/**
 * Unit cases from docs/test-plan.md §6.3: the catalogue's filters, ordering,
 * paging and sale prices, with every expected value worked out by hand.
 */
import { effectivePriceCents } from "../common/money";
import { totalPages } from "../common/pagination";
import { CatalogService } from "./catalog.service";
import { categoryWhere, priceWhere, searchWhere } from "./product-filters";

function row(id: string, name: string, priceCents: number) {
  return {
    id,
    slug: id,
    name,
    description: "",
    priceCents,
    discountPercent: 0,
    imageUrl: "",
    stock: 1,
    categories: [],
  };
}

function serviceReturning(rows: ReturnType<typeof row>[]) {
  const prisma = { product: { findMany: jest.fn().mockResolvedValue(rows) } };
  return new CatalogService(prisma as never);
}

describe("product filters", () => {
  it("SEARCH-01 U-CAT-01: a search matches part of the name ignoring case, and an empty search does not filter", () => {
    expect(searchWhere("Dock")).toEqual({ name: { contains: "Dock", mode: "insensitive" } });
    expect(searchWhere("")).toBeNull();
    expect(searchWhere(undefined)).toBeNull();
  });

  it("SEARCH-03 U-CAT-02: a category filter narrows to that category, and no category does not filter", () => {
    expect(categoryWhere("toys")).toEqual({ categories: { some: { category: { slug: "toys" } } } });
    expect(categoryWhere(undefined)).toBeNull();
  });

  it("SEARCH-06 U-CAT-03: price bounds are inclusive for min only, max only and both", () => {
    expect(priceWhere(500, undefined)).toEqual({ priceCents: { gte: 500 } });
    expect(priceWhere(undefined, 1500)).toEqual({ priceCents: { lte: 1500 } });
    expect(priceWhere(500, 1500)).toEqual({ priceCents: { gte: 500, lte: 1500 } });
    expect(priceWhere(undefined, undefined)).toBeNull();
  });
});

describe("catalogue ordering", () => {
  const rows = [
    row("prd_c", "Chair", 10000),
    row("prd_a", "Apple", 999),
    row("prd_b", "Bottle", 1000),
    row("prd_d", "Desk", 1000),
  ];

  it("SORT-01 U-CAT-04: sorts by name, and by price as a number in both directions", async () => {
    const names = async (sort: "name_asc" | "price_asc" | "price_desc") =>
      (await serviceReturning(rows).list({ sort, page: 1 })).items.map((item) => item.name);

    expect(await names("name_asc")).toEqual(["Apple", "Bottle", "Chair", "Desk"]);
    // 9.99 < 10.00 < 100.00 — compared as numbers, not as the strings "999" < "1000".
    expect(await names("price_asc")).toEqual(["Apple", "Bottle", "Desk", "Chair"]);
    expect(await names("price_desc")).toEqual(["Chair", "Bottle", "Desk", "Apple"]);
  });

  it("SORT-01 U-CAT-04: products of equal price come back in the same order whatever order the database returned them in", async () => {
    const forwards = await serviceReturning(rows).list({ sort: "price_asc", page: 1 });
    const backwards = await serviceReturning([...rows].reverse()).list({ sort: "price_asc", page: 1 });

    expect(backwards.items.map((item) => item.id)).toEqual(forwards.items.map((item) => item.id));
  });
});

describe("totalPages", () => {
  it.each([
    [0, 0],
    [1, 1],
    [12, 1],
    [13, 2],
    [24, 2],
    [25, 3],
  ])("SORT-03 U-CAT-05: %i products at 12 a page need %i pages", (products, pages) => {
    expect(totalPages(products, 12)).toBe(pages);
  });
});

describe("effectivePriceCents", () => {
  it.each([
    // [list price, percent off, price after the sale — by hand]
    [1999, 0, 1999],
    [1000, 10, 900],
    [1000, 33, 670],
    // 1999 × 25 % = 499.75 ¢ off → 500 ¢ to the nearest cent → 1499 ¢.
    [1999, 25, 1499],
    // 999 × 10 % = 99.9 ¢ off → 100 ¢ → 899 ¢.
    [999, 10, 899],
  ])("CATL-02 U-CAT-07: %i ¢ at %i %% off costs %i whole cents", (price, percent, expected) => {
    const result = effectivePriceCents(price, percent);

    expect(result).toBe(expected);
    expect(Number.isInteger(result)).toBe(true);
  });
});
