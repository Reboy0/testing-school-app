/**
 * API cases A-CART-01 … A-CART-17 from docs/test-plan.md §6.4. Amounts are
 * worked out by hand in the comment beside each assertion.
 */
import request from "supertest";
import { createProduct, createUser, loginAs } from "./factories";
import { cookiePair, setCookie } from "./plan-helpers";
import { createTestApp, TestApp } from "./setup";

const PASSWORD = "Password123!";

interface Line {
  id: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  discountCents: number;
  payableCents: number;
}

describe("cart API (A-CART)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await app.prisma.cart.deleteMany();
    await app.prisma.product.deleteMany();
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD });
    await createUser(app.prisma, { id: "usr_dana", email: "dana@example.com", password: PASSWORD });
    await createProduct(app.prisma, { id: "prd_dock", name: "iPhone dock", priceCents: 1999, discountPercent: 25 });
    await createProduct(app.prisma, { id: "prd_a", name: "Product A", priceCents: 1000 });
    await createProduct(app.prisma, { id: "prd_b", name: "Product B", priceCents: 350 });
    await createProduct(app.prisma, { id: "prd_c", name: "Product C", priceCents: 7, discountPercent: 10 });
  });

  const add = (cookies: string[], productId: string, quantity?: number) =>
    request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send(quantity === undefined ? { productId } : { productId, quantity });
  const getCart = (cookies: string[]) => request(app.server).get("/cart").set("Cookie", cookies);
  const quantities = (body: { lines: Line[] }) =>
    Object.fromEntries(body.lines.map((line) => [line.productId, line.quantity]));

  /** A brand-new signed-out visitor who has added `productId`: returns their cart cookie. */
  async function guestWith(productId: string, quantity = 1): Promise<string[]> {
    const res = await add([], productId, quantity).expect(200);
    return [cookiePair(res, "cart_token")];
  }

  describe("signed-out cart", () => {
    it("CRT-001 A-CART-01: a new visitor's cart is empty, and their first add gives them a cart cookie", async () => {
      const empty = await getCart([]).expect(200);
      expect(empty.body).toMatchObject({ itemCount: 0, lines: [], subtotalCents: 0, discountCents: 0, payableCents: 0 });

      const added = await add([], "prd_a").expect(200);
      expect(setCookie(added, "cart_token")).toMatch(/;\s*HttpOnly/i);
    });

    it("CRT-002 A-CART-02: a product a visitor added is still in their cart on a later request with the same cookie", async () => {
      const guest = await guestWith("prd_a", 2);

      const res = await getCart(guest).expect(200);
      expect(quantities(res.body)).toEqual({ prd_a: 2 });
    });

    it("CRT-004 A-CART-03: two different visitors have separate carts", async () => {
      const first = await guestWith("prd_a");
      const second = await guestWith("prd_b");

      expect(quantities((await getCart(first).expect(200)).body)).toEqual({ prd_a: 1 });
      expect(quantities((await getCart(second).expect(200)).body)).toEqual({ prd_b: 1 });
    });
  });

  describe("adding and changing lines", () => {
    let sam: string[];
    beforeEach(async () => {
      sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
    });

    it("CRT-006 A-CART-04: adding an existing product with quantity 1, or 5, answers 200 with a line of that quantity", async () => {
      expect(quantities((await add(sam, "prd_a", 1).expect(200)).body)).toEqual({ prd_a: 1 });
      expect(quantities((await add(sam, "prd_b", 5).expect(200)).body)).toEqual({ prd_a: 1, prd_b: 5 });
    });

    it("CRT-007 A-CART-05: a missing product answers 404, and a quantity of 0, -1 or 1.5 answers 400, leaving the cart unchanged", async () => {
      await add(sam, "prd_a", 1).expect(200);

      expect((await add(sam, "prd_nope", 1).expect(404)).body.code).toBe("NOT_FOUND");
      for (const quantity of [0, -1, 1.5]) {
        const res = await add(sam, "prd_b", quantity).expect(400);
        expect(res.body.code).toBe("VALIDATION_FAILED");
        expect(Object.keys(res.body.fieldErrors)).toEqual(["quantity"]);
      }

      expect(quantities((await getCart(sam).expect(200)).body)).toEqual({ prd_a: 1 });
    });

    it("CRT-008 A-CART-06: adding the same product twice (1, then 2) leaves one line with quantity 3", async () => {
      await add(sam, "prd_a", 1).expect(200);
      const res = await add(sam, "prd_a", 2).expect(200);

      expect(res.body.lines).toHaveLength(1);
      expect(res.body.lines[0]).toMatchObject({ productId: "prd_a", quantity: 3 });
      expect(res.body.itemCount).toBe(3);
    });

    it("CRT-011 A-CART-07: setting a line's quantity to 4 updates it and recalculates its amounts", async () => {
      const added = await add(sam, "prd_a", 1).expect(200);

      const res = await request(app.server)
        .patch(`/cart/items/${added.body.lines[0].id}`)
        .set("Cookie", sam)
        .send({ quantity: 4 })
        .expect(200);

      // 4 × 1000 ¢ = 4000 ¢, nothing off.
      expect(res.body.lines[0]).toMatchObject({ quantity: 4, lineTotalCents: 4000, payableCents: 4000 });
      expect(res.body).toMatchObject({ itemCount: 4, subtotalCents: 4000, payableCents: 4000 });
    });

    it("CRT-012 A-CART-08: setting a line's quantity to 0 removes the line", async () => {
      const added = await add(sam, "prd_a", 2).expect(200);

      const res = await request(app.server)
        .patch(`/cart/items/${added.body.lines[0].id}`)
        .set("Cookie", sam)
        .send({ quantity: 0 })
        .expect(200);

      expect(res.body).toMatchObject({ lines: [], itemCount: 0 });
    });

    it("CRT-013 A-CART-09: deleting a line removes it", async () => {
      await add(sam, "prd_a", 1).expect(200);
      const added = await add(sam, "prd_b", 1).expect(200);
      const lineB = added.body.lines.find((line: Line) => line.productId === "prd_b");

      const res = await request(app.server).delete(`/cart/items/${lineB.id}`).set("Cookie", sam).expect(200);

      expect(quantities(res.body)).toEqual({ prd_a: 1 });
    });
  });

  describe("merging on sign-in", () => {
    const signIn = (cookies: string[]) =>
      request(app.server).post("/auth/login").set("Cookie", cookies).send({ email: "sam@example.com", password: PASSWORD });

    it("CRT-016 A-CART-10: guest A×2, B×1 signing in to an account holding A×1, C×1 leaves A×3, B×1, C×1", async () => {
      const sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
      await add(sam, "prd_a", 1).expect(200);
      await add(sam, "prd_c", 1).expect(200);

      const guest = await guestWith("prd_a", 2);
      await add(guest, "prd_b", 1).expect(200);
      const signedIn = await signIn(guest).expect(200);

      const cart = await getCart((signedIn.get("set-cookie") ?? []) as unknown as string[]).expect(200);
      expect(quantities(cart.body)).toEqual({ prd_a: 3, prd_b: 1, prd_c: 1 });
    });

    it("CRT-017 A-CART-11: a guest with an empty cart signing in leaves the account's cart as it was", async () => {
      const sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
      await add(sam, "prd_a", 2).expect(200);

      const signedIn = await signIn([]).expect(200);

      const cart = await getCart((signedIn.get("set-cookie") ?? []) as unknown as string[]).expect(200);
      expect(quantities(cart.body)).toEqual({ prd_a: 2 });
    });

    it("CRT-018 A-CART-12: a guest with items signing in to an account with no cart brings every item across", async () => {
      const guest = await guestWith("prd_a", 2);
      await add(guest, "prd_b", 1).expect(200);

      const signedIn = await signIn(guest).expect(200);

      const cart = await getCart((signedIn.get("set-cookie") ?? []) as unknown as string[]).expect(200);
      expect(quantities(cart.body)).toEqual({ prd_a: 2, prd_b: 1 });
    });

    it("CRT-019 A-CART-13: after the merge the guest cookie is cleared, and signing in again with it does not add the guest's items twice", async () => {
      const guest = await guestWith("prd_a", 2);

      const first = await signIn(guest).expect(200);
      expect(setCookie(first, "cart_token")).toMatch(/^cart_token=;/);

      const second = await signIn(guest).expect(200);
      const cart = await getCart((second.get("set-cookie") ?? []) as unknown as string[]).expect(200);
      expect(quantities(cart.body)).toEqual({ prd_a: 2 });
    });
  });

  describe("amounts", () => {
    let sam: string[];
    beforeEach(async () => {
      sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
    });

    it("CRT-025 A-CART-14: iPhone dock (1999 ¢, 25 % off) × 3 totals 5997 ¢, takes 1499 ¢ off and leaves 4498 ¢ to pay", async () => {
      const res = await add(sam, "prd_dock", 3).expect(200);

      // 3 × 1999 = 5997 ¢; 25 % of 5997 = 1499.25 → 1499 ¢ (not 3 × 500 = 1500 ¢).
      expect(res.body.lines[0]).toMatchObject({ lineTotalCents: 5997, discountCents: 1499, payableCents: 4498 });
      expect(res.body).toMatchObject({ subtotalCents: 5997, discountCents: 1499, payableCents: 4498 });
    });

    it("CRT-028 A-CART-15: every line reports price, quantity, total and discount, and the cart its subtotal, discount and payable, in whole cents", async () => {
      await add(sam, "prd_a", 2).expect(200);
      await add(sam, "prd_b", 1).expect(200);
      const res = await getCart(sam).expect(200);

      for (const line of res.body.lines as Line[]) {
        for (const key of ["unitPriceCents", "quantity", "lineTotalCents", "discountCents", "payableCents"] as const) {
          expect(Number.isInteger(line[key])).toBe(true);
        }
      }
      // 2 × 1000 = 2000, 1 × 350 = 350, nothing off: 2350 / 0 / 2350.
      expect(res.body).toMatchObject({ subtotalCents: 2350, discountCents: 0, payableCents: 2350 });
      expect(res.body.lines.find((line: Line) => line.productId === "prd_a")).toMatchObject({
        unitPriceCents: 1000,
        quantity: 2,
        lineTotalCents: 2000,
        discountCents: 0,
      });
    });
  });

  describe("ownership", () => {
    it("CRT-033 A-CART-16: changing or deleting a line from somebody else's cart answers exactly as a missing line, and leaves it alone", async () => {
      const sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
      const dana = (await loginAs(app, "dana@example.com", PASSWORD)).cookies;
      const samsLine = (await add(sam, "prd_a", 1).expect(200)).body.lines[0].id;

      const foreignPatch = await request(app.server).patch(`/cart/items/${samsLine}`).set("Cookie", dana).send({ quantity: 9 });
      const missingPatch = await request(app.server).patch("/cart/items/line_missing").set("Cookie", dana).send({ quantity: 9 });
      const foreignDelete = await request(app.server).delete(`/cart/items/${samsLine}`).set("Cookie", dana);
      const missingDelete = await request(app.server).delete("/cart/items/line_missing").set("Cookie", dana);

      expect(foreignPatch.status).toBe(missingPatch.status);
      expect(foreignPatch.text).toBe(missingPatch.text);
      expect(foreignDelete.status).toBe(missingDelete.status);
      expect(foreignDelete.text).toBe(missingDelete.text);
      expect(quantities((await getCart(sam).expect(200)).body)).toEqual({ prd_a: 1 });
    });

    it("CRT-034 A-CART-17: a signed-out visitor changing a signed-in user's line gets the missing-line answer", async () => {
      const sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
      const samsLine = (await add(sam, "prd_a", 1).expect(200)).body.lines[0].id;
      const guest = await guestWith("prd_b");

      const foreign = await request(app.server).patch(`/cart/items/${samsLine}`).set("Cookie", guest).send({ quantity: 9 });
      const missing = await request(app.server).patch("/cart/items/line_missing").set("Cookie", guest).send({ quantity: 9 });

      expect(foreign.status).toBe(404);
      expect(foreign.text).toBe(missing.text);
      expect(quantities((await getCart(sam).expect(200)).body)).toEqual({ prd_a: 1 });
    });
  });
});
