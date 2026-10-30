/**
 * OpenCards suite «API»: /products, /categories, /cart, /health and the
 * error envelope, API-31 … API-45.
 */
import request from "supertest";
import { createCategory, createProduct, createUser, loginAs } from "../factories";
import { cookiePair, expectErrorContract, setCookie } from "../plan-helpers";
import { createTestApp, TestApp } from "../setup";

const PASSWORD = "Password123!";

describe("API suite: catalogue, cart and service endpoints", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await app.prisma.cart.deleteMany();
    await app.prisma.product.deleteMany();
    await app.prisma.category.deleteMany();
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD });
    await createUser(app.prisma, { id: "usr_dana", email: "dana@example.com", password: PASSWORD });
    await createCategory(app.prisma, { id: "cat_toys", slug: "toys", name: "Toys" });
    await createCategory(app.prisma, { id: "cat_books", slug: "books", name: "Books" });
  });

  describe("GET /products", () => {
    it("API-31: with no query answers 200 with page 1 of 12, sorted by name, and every product field", async () => {
      for (const name of ["Cup", "Apple", "Bowl"]) {
        await createProduct(app.prisma, { id: `prd_${name.toLowerCase()}`, name, priceCents: 500, categoryIds: ["cat_toys"] });
      }

      const res = await request(app.server).get("/products").expect(200);

      expect(res.body).toMatchObject({ page: 1, pageSize: 12, total: 3, totalPages: 1 });
      expect(res.body.items.map((item: { name: string }) => item.name)).toEqual(["Apple", "Bowl", "Cup"]);
      expect(Object.keys(res.body.items[0]).sort()).toEqual(
        ["categories", "description", "discountPercent", "effectivePriceCents", "id", "imageUrl", "name", "priceCents", "slug", "stock"],
      );
    });

    it("API-32: q, category, minPrice, maxPrice and sort apply together", async () => {
      await createProduct(app.prisma, { id: "prd_1", name: "Toy car", priceCents: 1500, categoryIds: ["cat_toys"] });
      await createProduct(app.prisma, { id: "prd_2", name: "Toy boat", priceCents: 1200, categoryIds: ["cat_toys"] });
      await createProduct(app.prisma, { id: "prd_3", name: "Toy story book", priceCents: 1300, categoryIds: ["cat_books"] });
      await createProduct(app.prisma, { id: "prd_4", name: "Toy plane", priceCents: 9000, categoryIds: ["cat_toys"] });
      await createProduct(app.prisma, { id: "prd_5", name: "Kite", priceCents: 1400, categoryIds: ["cat_toys"] });

      const res = await request(app.server).get("/products?q=toy&category=toys&minPrice=1000&maxPrice=2000&sort=price_asc").expect(200);

      expect(res.body.items.map((item: { id: string }) => item.id)).toEqual(["prd_2", "prd_1"]);
    });

    it("API-33: page 0, an unknown sort and a negative price each answer 400 against that parameter", async () => {
      for (const [query, field] of [["page=0", "page"], ["sort=newest", "sort"], ["minPrice=-1", "minPrice"]]) {
        const res = await request(app.server).get(`/products?${query}`).expect(400);
        expect(Object.keys(res.body.fieldErrors)).toEqual([field]);
      }
    });

    it("API-34: totalPages is total / 12 rounded up, and the last page holds the remainder", async () => {
      for (let index = 1; index <= 13; index += 1) {
        await createProduct(app.prisma, { id: `prd_${String(index).padStart(2, "0")}`, name: `Item ${String(index).padStart(2, "0")}`, priceCents: 100 });
      }

      const first = await request(app.server).get("/products").expect(200);
      const last = await request(app.server).get("/products?page=2").expect(200);

      expect(first.body).toMatchObject({ total: 13, totalPages: 2 });
      expect(last.body.items).toHaveLength(1);
    });
  });

  describe("GET /categories", () => {
    it("API-35: answers 200 with every category's id, slug and name, sorted by name", async () => {
      const res = await request(app.server).get("/categories").expect(200);

      expect(res.body).toEqual([
        { id: "cat_books", slug: "books", name: "Books" },
        { id: "cat_toys", slug: "toys", name: "Toys" },
      ]);
    });
  });

  describe("/cart", () => {
    beforeEach(async () => {
      await createProduct(app.prisma, { id: "prd_pen", name: "Pen", priceCents: 350 });
      await createProduct(app.prisma, { id: "prd_cup", name: "Cup", priceCents: 1000 });
    });

    it("API-36: GET for a visitor with no cart answers 200 with an empty cart and issues no cookie", async () => {
      const res = await request(app.server).get("/cart").expect(200);

      expect(res.body).toEqual({ id: null, itemCount: 0, lines: [], subtotalCents: 0, discountCents: 0, payableCents: 0 });
      expect(setCookie(res, "cart_token")).toBeUndefined();
    });

    it("API-37: POST /cart/items as a guest answers 200 with the whole cart and sets an HttpOnly cart cookie", async () => {
      const res = await request(app.server).post("/cart/items").send({ productId: "prd_pen", quantity: 2 }).expect(200);

      expect(res.body).toMatchObject({ itemCount: 2, subtotalCents: 700, payableCents: 700 });
      expect(res.body.lines[0]).toMatchObject({ productId: "prd_pen", name: "Pen", quantity: 2, unitPriceCents: 350 });
      expect(setCookie(res, "cart_token")).toMatch(/HttpOnly/i);
    });

    it("API-38: POST with a missing productId or quantity 0 answers 400, and an unknown product 404", async () => {
      const missing = await request(app.server).post("/cart/items").send({ quantity: 1 }).expect(400);
      expect(Object.keys(missing.body.fieldErrors)).toEqual(["productId"]);

      await request(app.server).post("/cart/items").send({ productId: "prd_pen", quantity: 0 }).expect(400);

      const unknown = await request(app.server).post("/cart/items").send({ productId: "prd_nope" }).expect(404);
      expect(unknown.body.code).toBe("NOT_FOUND");
    });

    it("API-39: POST of a product already in the cart raises that line's quantity instead of adding a line", async () => {
      const first = await request(app.server).post("/cart/items").send({ productId: "prd_pen" }).expect(200);
      const cookie = [cookiePair(first, "cart_token")];

      const res = await request(app.server).post("/cart/items").set("Cookie", cookie).send({ productId: "prd_pen", quantity: 2 }).expect(200);

      expect(res.body.lines).toHaveLength(1);
      expect(res.body.lines[0].quantity).toBe(3);
    });

    it("API-40: PATCH /cart/items/:id answers 200 with the new quantity, and quantity 0 removes the line", async () => {
      const added = await request(app.server).post("/cart/items").send({ productId: "prd_cup" }).expect(200);
      const cookie = [cookiePair(added, "cart_token")];
      const lineId = added.body.lines[0].id;

      const changed = await request(app.server).patch(`/cart/items/${lineId}`).set("Cookie", cookie).send({ quantity: 3 }).expect(200);
      expect(changed.body).toMatchObject({ itemCount: 3, subtotalCents: 3000 });

      const emptied = await request(app.server).patch(`/cart/items/${lineId}`).set("Cookie", cookie).send({ quantity: 0 }).expect(200);
      expect(emptied.body).toMatchObject({ lines: [], itemCount: 0 });
    });

    it("API-41: PATCH with a negative or fractional quantity answers 400 against quantity", async () => {
      const added = await request(app.server).post("/cart/items").send({ productId: "prd_cup" }).expect(200);
      const cookie = [cookiePair(added, "cart_token")];

      for (const quantity of [-1, 1.5]) {
        const res = await request(app.server).patch(`/cart/items/${added.body.lines[0].id}`).set("Cookie", cookie).send({ quantity }).expect(400);
        expect(Object.keys(res.body.fieldErrors)).toEqual(["quantity"]);
      }
    });

    it("API-42: PATCH and DELETE of a line in somebody else's cart answer exactly as for a missing line: 404 NOT_FOUND", async () => {
      const sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
      const dana = (await loginAs(app, "dana@example.com", PASSWORD)).cookies;
      const lineId = (await request(app.server).post("/cart/items").set("Cookie", sam).send({ productId: "prd_pen" }).expect(200)).body.lines[0].id;

      const answers = [
        await request(app.server).patch(`/cart/items/${lineId}`).set("Cookie", dana).send({ quantity: 5 }),
        await request(app.server).patch("/cart/items/line_missing").set("Cookie", dana).send({ quantity: 5 }),
        await request(app.server).delete(`/cart/items/${lineId}`).set("Cookie", dana),
        await request(app.server).delete("/cart/items/line_missing").set("Cookie", dana),
      ];

      for (const res of answers) {
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ code: "NOT_FOUND", message: "That item is not in your cart", fieldErrors: null });
      }
      expect((await request(app.server).get("/cart").set("Cookie", sam).expect(200)).body.itemCount).toBe(1);
    });

    it("API-43: DELETE /cart/items/:id answers 200 with the cart as it now stands, totals included", async () => {
      const first = await request(app.server).post("/cart/items").send({ productId: "prd_pen" }).expect(200);
      const cookie = [cookiePair(first, "cart_token")];
      const both = await request(app.server).post("/cart/items").set("Cookie", cookie).send({ productId: "prd_cup" }).expect(200);
      const penLine = both.body.lines.find((line: { productId: string }) => line.productId === "prd_pen").id;

      const res = await request(app.server).delete(`/cart/items/${penLine}`).set("Cookie", cookie).expect(200);

      expect(res.body).toMatchObject({ itemCount: 1, subtotalCents: 1000, payableCents: 1000 });
      expect(res.body.lines.map((line: { productId: string }) => line.productId)).toEqual(["prd_cup"]);
    });
  });

  describe("service", () => {
    it("API-44: GET /health answers 200 {status: ok}", async () => {
      const res = await request(app.server).get("/health").expect(200);

      expect(res.body).toEqual({ status: "ok" });
    });

    it("API-45: an unknown route answers 404 and a malformed JSON body 400, both in the error envelope", async () => {
      const missing = await request(app.server).delete("/nowhere").expect(404);
      expectErrorContract(missing.body);

      const malformed = await request(app.server).post("/cart/items").set("Content-Type", "application/json").send("{oops").expect(400);
      expectErrorContract(malformed.body);
      expect(malformed.body.fieldErrors).toBeNull();
    });
  });
});
