import request from "supertest";
import { createTestApp, TestApp } from "./setup";
import { createCategory, createProduct } from "./factories";

describe("catalogue", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    // Products cascade to their category links, so the join rows go with them.
    await app.prisma.product.deleteMany();
    await app.prisma.category.deleteMany();
    await createCategory(app.prisma, { id: "cat_tools", slug: "tools", name: "Tools" });
    await createCategory(app.prisma, { id: "cat_paper", slug: "paper", name: "Paper" });
  });

  it("CATL-017: describes a product with its price, its sale price and its categories", async () => {
    await createProduct(app.prisma, {
      id: "prd_dock",
      slug: "dock",
      name: "Docking station",
      priceCents: 1999,
      discountPercent: 25,
      stock: 4,
      categoryIds: ["cat_tools"],
    });

    const res = await request(app.server).get("/products").expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: "prd_dock",
      slug: "dock",
      name: "Docking station",
      priceCents: 1999,
      discountPercent: 25,
      // 1999 cents less 25% (500 cents, rounded) — worked out by hand.
      effectivePriceCents: 1499,
      stock: 4,
    });
    expect(res.body.items[0].categories).toEqual([
      { id: "cat_tools", slug: "tools", name: "Tools" },
    ]);
  });

  it("CATL-018: puts twelve products on a page and says how many there are in total", async () => {
    for (let index = 1; index <= 20; index += 1) {
      const label = String(index).padStart(2, "0");
      await createProduct(app.prisma, {
        id: `prd_${label}`,
        name: `Item ${label}`,
        priceCents: 1000 + index,
        categoryIds: ["cat_tools"],
      });
    }

    const first = await request(app.server).get("/products").expect(200);
    expect(first.body.items).toHaveLength(12);
    expect(first.body.items[0].name).toBe("Item 01");
    expect(first.body).toMatchObject({ page: 1, pageSize: 12, total: 20, totalPages: 2 });

    const second = await request(app.server).get("/products?page=2").expect(200);
    expect(second.body.items).toHaveLength(8);
    expect(second.body.items[0].name).toBe("Item 13");
    expect(second.body.page).toBe(2);
  });

  it("CATL-019: searches names without caring about case", async () => {
    await createProduct(app.prisma, { id: "prd_blue", name: "Blue notebook", priceCents: 500 });
    await createProduct(app.prisma, { id: "prd_red", name: "Red pen", priceCents: 300 });

    const res = await request(app.server).get("/products?q=BLUE").expect(200);

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(["prd_blue"]);
  });

  it("CATL-020: returns only the products in the category asked for, including ones in several", async () => {
    await createProduct(app.prisma, {
      id: "prd_hammer",
      name: "Hammer",
      priceCents: 900,
      categoryIds: ["cat_tools"],
    });
    await createProduct(app.prisma, {
      id: "prd_pad",
      name: "Notepad",
      priceCents: 400,
      categoryIds: ["cat_paper"],
    });
    await createProduct(app.prisma, {
      id: "prd_ruler",
      name: "Ruler",
      priceCents: 600,
      categoryIds: ["cat_tools", "cat_paper"],
    });

    const res = await request(app.server).get("/products?category=paper").expect(200);

    expect(res.body.items.map((item: { id: string }) => item.id).sort()).toEqual([
      "prd_pad",
      "prd_ruler",
    ]);
  });

  it("CATL-021: keeps only the products inside a price range", async () => {
    await createProduct(app.prisma, { id: "prd_cheap", name: "Cheap thing", priceCents: 500 });
    await createProduct(app.prisma, { id: "prd_mid", name: "Middling thing", priceCents: 1500 });
    await createProduct(app.prisma, { id: "prd_dear", name: "Dear thing", priceCents: 5000 });

    const res = await request(app.server)
      .get("/products?minPrice=1000&maxPrice=3000")
      .expect(200);

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(["prd_mid"]);
  });

  it("CATL-022: sorts by price, most expensive first", async () => {
    await createProduct(app.prisma, { id: "prd_a", name: "Aaa", priceCents: 1250, categoryIds: ["cat_tools"] });
    await createProduct(app.prisma, { id: "prd_b", name: "Bbb", priceCents: 1899, categoryIds: ["cat_tools"] });
    await createProduct(app.prisma, { id: "prd_c", name: "Ccc", priceCents: 1499, categoryIds: ["cat_tools"] });

    const res = await request(app.server).get("/products?sort=price_desc").expect(200);

    expect(res.body.items.map((item: { priceCents: number }) => item.priceCents)).toEqual([
      1899, 1499, 1250,
    ]);
  });

  it("CATL-023: lists the categories", async () => {
    const res = await request(app.server).get("/categories").expect(200);

    expect(res.body).toEqual([
      { id: "cat_paper", slug: "paper", name: "Paper" },
      { id: "cat_tools", slug: "tools", name: "Tools" },
    ]);
  });

  it("CATL-024: rejects a page number below one", async () => {
    const res = await request(app.server).get("/products?page=0").expect(400);

    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.fieldErrors.page).toEqual(["Page must be at least 1"]);
  });
});
