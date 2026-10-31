import request from "supertest";
import { createTestApp, TestApp } from "./setup";
import { createProduct, createUser, loginAs } from "./factories";

/** The `cart_token` cookie the API hands a signed-out visitor, as a header. */
function cartCookie(res: request.Response): string {
  const cookies = (res.get("set-cookie") ?? []) as unknown as string[];
  const cookie = cookies.find((value) => value.startsWith("cart_token="));
  if (!cookie) throw new Error(`No cart_token cookie in ${JSON.stringify(cookies)}`);
  return cookie.split(";")[0];
}

describe("cart", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await app.prisma.cart.deleteMany();
    await app.prisma.product.deleteMany();
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: "Password123!" });
    await createProduct(app.prisma, {
      id: "prd_dock",
      name: "Docking station",
      priceCents: 1999,
      discountPercent: 25,
      stock: 9,
    });
    await createProduct(app.prisma, { id: "prd_pen", name: "Pen", priceCents: 350, stock: 40 });
  });

  it("CRT-051: is empty for a visitor who has never added anything", async () => {
    const res = await request(app.server).get("/cart").expect(200);

    expect(res.body).toMatchObject({ itemCount: 0, lines: [], payableCents: 0 });
  });

  it("CRT-052: gives a signed-out visitor a cart of their own, and a cookie to find it again", async () => {
    const added = await request(app.server)
      .post("/cart/items")
      .send({ productId: "prd_pen", quantity: 1 })
      .expect(200);

    expect(added.body.itemCount).toBe(1);
    expect(added.body.lines).toHaveLength(1);
    expect(added.body.lines[0]).toMatchObject({ productId: "prd_pen", name: "Pen", quantity: 1 });

    const reread = await request(app.server).get("/cart").set("Cookie", [cartCookie(added)]).expect(200);
    expect(reread.body.lines).toHaveLength(1);
    expect(reread.body.lines[0].productId).toBe("prd_pen");
  });

  it("CRT-053: keeps a signed-in user's cart apart from a signed-out visitor's", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    await request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send({ productId: "prd_dock", quantity: 1 })
      .expect(200);

    const guest = await request(app.server)
      .post("/cart/items")
      .send({ productId: "prd_pen", quantity: 1 })
      .expect(200);

    const mine = await request(app.server).get("/cart").set("Cookie", cookies).expect(200);
    expect(mine.body.lines.map((line: { productId: string }) => line.productId)).toEqual(["prd_dock"]);

    const theirs = await request(app.server).get("/cart").set("Cookie", [cartCookie(guest)]).expect(200);
    expect(theirs.body.lines.map((line: { productId: string }) => line.productId)).toEqual(["prd_pen"]);
  });

  it("CRT-054: reports the line totals, the discount and what is payable", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    await request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send({ productId: "prd_dock", quantity: 1 })
      .expect(200);
    const res = await request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send({ productId: "prd_pen", quantity: 2 })
      .expect(200);

    // 1 x 1999 at 25% off is 1999 less 500 (499.75 rounded) = 1499.
    // 2 x 350 at no discount is 700. Subtotal 2699, off 500, payable 2199.
    expect(res.body).toMatchObject({
      itemCount: 3,
      subtotalCents: 2699,
      discountCents: 500,
      payableCents: 2199,
    });
    const dock = res.body.lines.find((line: { productId: string }) => line.productId === "prd_dock");
    expect(dock).toMatchObject({ lineTotalCents: 1999, discountCents: 500, payableCents: 1499 });
  });

  it("CRT-055: changes a line's quantity", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const added = await request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send({ productId: "prd_pen", quantity: 1 })
      .expect(200);

    const res = await request(app.server)
      .patch(`/cart/items/${added.body.lines[0].id}`)
      .set("Cookie", cookies)
      .send({ quantity: 2 })
      .expect(200);

    expect(res.body.itemCount).toBe(2);
    expect(res.body.lines[0]).toMatchObject({ quantity: 2, lineTotalCents: 700, payableCents: 700 });
  });

  it("CRT-056: removes the line when its quantity is set to zero", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const added = await request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send({ productId: "prd_pen", quantity: 1 })
      .expect(200);

    const res = await request(app.server)
      .patch(`/cart/items/${added.body.lines[0].id}`)
      .set("Cookie", cookies)
      .send({ quantity: 0 })
      .expect(200);

    expect(res.body.lines).toEqual([]);
    expect(res.body.itemCount).toBe(0);
  });

  it("CRT-057: deletes a line", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const added = await request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send({ productId: "prd_pen", quantity: 1 })
      .expect(200);

    const res = await request(app.server)
      .delete(`/cart/items/${added.body.lines[0].id}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(res.body.lines).toEqual([]);
  });

  it("CRT-058: will not touch a line that is in somebody else's cart", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const mine = await request(app.server)
      .post("/cart/items")
      .set("Cookie", cookies)
      .send({ productId: "prd_pen", quantity: 1 })
      .expect(200);

    await request(app.server).delete(`/cart/items/${mine.body.lines[0].id}`).expect(404);

    const still = await request(app.server).get("/cart").set("Cookie", cookies).expect(200);
    expect(still.body.lines).toHaveLength(1);
  });

  it("CRT-059: rejects a quantity below one", async () => {
    const res = await request(app.server)
      .post("/cart/items")
      .send({ productId: "prd_pen", quantity: 0 })
      .expect(400);

    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.fieldErrors.quantity).toEqual(["Quantity must be at least 1"]);
  });

  it("CRT-060: rejects a product that does not exist", async () => {
    const res = await request(app.server)
      .post("/cart/items")
      .send({ productId: "prd_nope", quantity: 1 })
      .expect(404);

    expect(res.body.code).toBe("NOT_FOUND");
  });
});
