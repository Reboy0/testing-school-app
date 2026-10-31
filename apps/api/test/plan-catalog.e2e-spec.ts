/**
 * API cases A-CAT-01 … A-CAT-16 from docs/test-plan.md §6.3. Every product a
 * test asserts on is created by that test, with the price it needs.
 */
import request from "supertest";
import { createCategory, createProduct } from "./factories";
import { createTestApp, TestApp } from "./setup";

interface Item {
  id: string;
  name: string;
  priceCents: number;
  discountPercent: number;
  effectivePriceCents: number;
  categories: { slug: string }[];
}

describe("catalogue API (A-CAT)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await app.prisma.product.deleteMany();
    await app.prisma.category.deleteMany();
    for (const [slug, name] of [
      ["electronics", "Electronics"],
      ["furniture", "Furniture"],
      ["toys", "Toys"],
      ["books", "Books"],
      ["garden", "Garden"],
    ]) {
      await createCategory(app.prisma, { id: `cat_${slug}`, slug, name });
    }
  });

  const products = (query = "") => request(app.server).get(`/products${query}`);
  const ids = (res: request.Response) => (res.body.items as Item[]).map((item) => item.id);

  /** Creates `count` products named Item 01 … at the given price. */
  async function createMany(count: number, price: (index: number) => number = () => 1000, categoryIds = ["cat_toys"]) {
    for (let index = 1; index <= count; index += 1) {
      const label = String(index).padStart(2, "0");
      await createProduct(app.prisma, { id: `prd_${label}`, name: `Item ${label}`, priceCents: price(index), categoryIds });
    }
  }

  it("CATL-001 A-CAT-01: every product carries id, slug, name, description, price, discount, sale price, image, stock and categories", async () => {
    await createProduct(app.prisma, {
      id: "prd_lamp",
      slug: "desk-lamp",
      name: "Desk lamp",
      priceCents: 3450,
      stock: 25,
      categoryIds: ["cat_electronics", "cat_furniture"],
    });

    const [item] = (await products().expect(200)).body.items;

    expect(Object.keys(item).sort()).toEqual(
      ["categories", "description", "discountPercent", "effectivePriceCents", "id", "imageUrl", "name", "priceCents", "slug", "stock"].sort(),
    );
    expect(item).toMatchObject({
      id: "prd_lamp",
      slug: "desk-lamp",
      name: "Desk lamp",
      description: "Desk lamp description",
      priceCents: 3450,
      discountPercent: 0,
      effectivePriceCents: 3450,
      imageUrl: "/product-placeholder.svg",
      stock: 25,
    });
    expect(item.categories.map((category: { slug: string }) => category.slug).sort()).toEqual(["electronics", "furniture"]);
  });

  it("CATL-011 A-CAT-02: the six seeded sale products and a full-price one report the discount and sale price worked out by hand", async () => {
    const sale = [
      // [id, name, list price, % off, sale price by hand]
      ["prd_dock", "iPhone dock", 1999, 25, 1499], //  499.75 → 500 off
      ["prd_speaker", "Bluetooth speaker", 5990, 10, 5391], //  599 off
      ["prd_keyboard", "Mechanical keyboard", 8900, 15, 7565], // 1335 off
      ["prd_table", "Coffee table", 15900, 10, 14310], // 1590 off
      ["prd_desk", "Standing desk", 34900, 5, 33155], // 1745 off
      ["prd_train", "Wooden train set", 4599, 20, 3679], //  919.8 → 920 off
      ["prd_cable", "USB-C cable", 899, 0, 899],
    ] as const;
    for (const [id, name, priceCents, discountPercent] of sale) {
      await createProduct(app.prisma, { id, name, priceCents, discountPercent });
    }

    const items: Item[] = (await products().expect(200)).body.items;

    for (const [id, , priceCents, discountPercent, effectivePriceCents] of sale) {
      expect(items.find((item) => item.id === id)).toMatchObject({ priceCents, discountPercent, effectivePriceCents });
    }
  });

  it("SEARCH-002 A-CAT-03: a search in lower, upper or mixed case, or for part of a word, finds only names containing it", async () => {
    await createProduct(app.prisma, { id: "prd_dock", name: "iPhone dock", priceCents: 1999 });
    await createProduct(app.prisma, { id: "prd_docker", name: "Dockerfile poster", priceCents: 500 });
    await createProduct(app.prisma, { id: "prd_lamp", name: "Desk lamp", priceCents: 3450 });

    for (const q of ["dock", "DOCK", "DoCk"]) {
      expect(ids(await products(`?q=${q}`).expect(200)).sort()).toEqual(["prd_dock", "prd_docker"]);
    }
    expect(ids(await products("?q=amp").expect(200))).toEqual(["prd_lamp"]);
  });

  it("SEARCH-004 A-CAT-04: a search with no match, or with %, _ or ', answers 200 with an empty list", async () => {
    await createProduct(app.prisma, { id: "prd_dock", name: "iPhone dock", priceCents: 1999 });
    await createProduct(app.prisma, { id: "prd_lamp", name: "Desk lamp", priceCents: 3450 });

    for (const q of ["zeppelin", "%", "_", "'"]) {
      const res = await products(`?q=${encodeURIComponent(q)}`).expect(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
    }
  });

  it("SEARCH-006 A-CAT-05: a category filter returns only that category's products, including those that are in several", async () => {
    await createProduct(app.prisma, { id: "prd_lamp", name: "Desk lamp", priceCents: 3450, categoryIds: ["cat_electronics", "cat_furniture"] });
    await createProduct(app.prisma, { id: "prd_chair", name: "Chair", priceCents: 9000, categoryIds: ["cat_furniture"] });
    await createProduct(app.prisma, { id: "prd_cable", name: "Cable", priceCents: 899, categoryIds: ["cat_electronics"] });

    expect(ids(await products("?category=furniture").expect(200)).sort()).toEqual(["prd_chair", "prd_lamp"]);
  });

  it("SEARCH-007 A-CAT-06: a category that does not exist answers an empty result or a 400, never a 500", async () => {
    await createProduct(app.prisma, { id: "prd_chair", name: "Chair", priceCents: 9000, categoryIds: ["cat_furniture"] });

    const res = await products("?category=spaceships");
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) expect(res.body.items).toEqual([]);
  });

  it("SEARCH-008 A-CAT-07: GET /categories lists all five categories with slug and name", async () => {
    const res = await request(app.server).get("/categories").expect(200);

    expect(res.body.map(({ slug, name }: { slug: string; name: string }) => ({ slug, name }))).toEqual(
      expect.arrayContaining([
        { slug: "electronics", name: "Electronics" },
        { slug: "furniture", name: "Furniture" },
        { slug: "toys", name: "Toys" },
        { slug: "books", name: "Books" },
        { slug: "garden", name: "Garden" },
      ]),
    );
    expect(res.body).toHaveLength(5);
  });

  it("SEARCH-010 A-CAT-08: a category with a price range returns only products meeting both, and misses none that do", async () => {
    await createProduct(app.prisma, { id: "prd_in", name: "Toy in range", priceCents: 1500, categoryIds: ["cat_toys"] });
    await createProduct(app.prisma, { id: "prd_dear_toy", name: "Toy too dear", priceCents: 9000, categoryIds: ["cat_toys"] });
    await createProduct(app.prisma, { id: "prd_book", name: "Book in range", priceCents: 1500, categoryIds: ["cat_books"] });

    const res = await products("?category=toys&minPrice=1000&maxPrice=2000").expect(200);

    expect(ids(res)).toEqual(["prd_in"]);
  });

  it("SEARCH-011 A-CAT-09: search, category, price and sort all apply together", async () => {
    await createProduct(app.prisma, { id: "prd_a", name: "Wooden train", priceCents: 1800, categoryIds: ["cat_toys"] });
    await createProduct(app.prisma, { id: "prd_b", name: "Wooden blocks", priceCents: 1200, categoryIds: ["cat_toys"] });
    await createProduct(app.prisma, { id: "prd_c", name: "Wooden spoon", priceCents: 1500, categoryIds: ["cat_garden"] });
    await createProduct(app.prisma, { id: "prd_d", name: "Plastic train", priceCents: 1400, categoryIds: ["cat_toys"] });
    await createProduct(app.prisma, { id: "prd_e", name: "Wooden castle", priceCents: 5000, categoryIds: ["cat_toys"] });

    const res = await products("?q=wooden&category=toys&minPrice=1000&maxPrice=2000&sort=price_desc").expect(200);

    expect(ids(res)).toEqual(["prd_a", "prd_b"]);
  });

  it("SEARCH-015 A-CAT-10: a product priced exactly at minPrice, and one priced exactly at maxPrice, are both included", async () => {
    await createProduct(app.prisma, { id: "prd_low", name: "Low", priceCents: 1000 });
    await createProduct(app.prisma, { id: "prd_high", name: "High", priceCents: 2000 });

    expect(ids(await products("?minPrice=1000").expect(200))).toContain("prd_low");
    expect(ids(await products("?maxPrice=2000").expect(200))).toContain("prd_high");
    expect(ids(await products("?minPrice=1000&maxPrice=2000").expect(200)).sort()).toEqual(["prd_high", "prd_low"]);
  });

  it("SEARCH-017 A-CAT-11: minPrice above maxPrice, negative or non-numeric prices answer empty or 400, never 500", async () => {
    await createProduct(app.prisma, { id: "prd_mid", name: "Mid", priceCents: 1500 });

    for (const query of ["?minPrice=2000&maxPrice=1000", "?minPrice=-5", "?maxPrice=-1", "?minPrice=cheap", "?maxPrice=1.5e"]) {
      const res = await products(query);
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) expect(res.body.items).toEqual([]);
    }
  });

  it("SORT-003 A-CAT-12: sorting by price ascending and descending is numeric: 9.99 < 10.00 < 100.00", async () => {
    await createProduct(app.prisma, { id: "prd_100", name: "Hundred", priceCents: 10000 });
    await createProduct(app.prisma, { id: "prd_999", name: "Nine ninety-nine", priceCents: 999 });
    await createProduct(app.prisma, { id: "prd_10", name: "Ten", priceCents: 1000 });

    const asc = (await products("?sort=price_asc").expect(200)).body.items.map((item: Item) => item.priceCents);
    const desc = (await products("?sort=price_desc").expect(200)).body.items.map((item: Item) => item.priceCents);

    expect(asc).toEqual([999, 1000, 10000]);
    expect(desc).toEqual([10000, 1000, 999]);
  });

  it("SORT-005 A-CAT-13: products of equal price across a page boundary keep one order between requests, with no duplicates or gaps", async () => {
    await createMany(15, () => 1000);

    const firstRun = [...ids(await products("?sort=price_asc&page=1")), ...ids(await products("?sort=price_asc&page=2"))];
    const secondRun = [...ids(await products("?sort=price_asc&page=1")), ...ids(await products("?sort=price_asc&page=2"))];

    expect(secondRun).toEqual(firstRun);
    expect(new Set(firstRun).size).toBe(15);
  });

  it("SORT-012 A-CAT-14: page 1 holds 12 products and reports page, pageSize 12, total and totalPages", async () => {
    await createMany(24, (index) => 1000 + index);

    const res = await products().expect(200);

    expect(res.body.items).toHaveLength(12);
    expect(res.body).toMatchObject({ page: 1, pageSize: 12, total: 24, totalPages: 2 });
  });

  it("SORT-018 A-CAT-15: walking every page of a result whose total is not a multiple of 12 reaches every product exactly once", async () => {
    await createMany(25, (index) => 1000 + index);

    const first = (await products().expect(200)).body;
    // 25 / 12 = 2.08… → 3 pages, the last one holding a single product.
    expect(first.totalPages).toBe(3);

    const seen: string[] = [];
    for (let page = 1; page <= first.totalPages; page += 1) {
      seen.push(...ids(await products(`?page=${page}`).expect(200)));
    }
    expect(seen).toHaveLength(first.total);
    expect(new Set(seen).size).toBe(25);
    expect(ids(await products("?page=3").expect(200))).toHaveLength(1);
  });

  it("SORT-020 A-CAT-16: a page past the end is empty; page 0 and a non-numeric page answer 400", async () => {
    await createMany(5);

    expect((await products("?page=9").expect(200)).body.items).toEqual([]);
    expect((await products("?page=0").expect(400)).body.fieldErrors.page).toBeDefined();
    expect((await products("?page=two").expect(400)).body.fieldErrors.page).toBeDefined();
  });
});
