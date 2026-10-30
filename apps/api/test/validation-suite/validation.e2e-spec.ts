/**
 * OpenCards suite «Валідація» (prefix VAL), API level: every endpoint that
 * takes input, fed one invalid value at a time. Each case checks the full
 * contract — 400, VALIDATION_FAILED, the error against exactly the right
 * field — and that nothing was written.
 */
import request from "supertest";
import { createProduct, createUser, loginAs } from "../factories";
import { expectErrorContract } from "../plan-helpers";
import { createTestApp, TestApp } from "../setup";
import { withIds } from "../ids";

const PASSWORD = "Password123!";

const INVALID_EMAILS = ["", "plainaddress", "a@", "@example.com", "ada@example", "ada example@example.com", "ada@@example.com", "ada..x@example.com"];
const PASSWORD_RULES: [string, string, string][] = [
  ["9 characters", "Abcdefgh1", "Password must be at least 10 characters"],
  ["no uppercase letter", "abcdefghi1", "Password must contain an uppercase letter"],
  ["no lowercase letter", "ABCDEFGHI1", "Password must contain a lowercase letter"],
  ["no digit", "Abcdefghij", "Password must contain a digit"],
];

describe("API validation (VAL)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  /** A 400 VALIDATION_FAILED whose fieldErrors name exactly `fields`. */
  function expectRejected(res: request.Response, fields: readonly string[]) {
    expect(res.status).toBe(400);
    expectErrorContract(res.body);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual([...fields].sort());
  }

  describe("POST /auth/register", () => {
    const valid = { email: "ada@example.com", name: "Ada", password: "Abcdefghi1" };
    const register = (body: object) => request(app.server).post("/auth/register").send(body);

    it.each(withIds("VAL-026", "VAL-033", INVALID_EMAILS))("%s: registering with the email %j answers 400 against email and creates no account", async (_id, email) => {
      expectRejected(await register({ ...valid, email }), ["email"]);
      expect(await app.prisma.user.count()).toBe(0);
    });

    it.each(withIds("VAL-048", "VAL-051", PASSWORD_RULES))("%s: registering with a password with %s answers 400 with %j", async (_id, _case, password, message) => {
      const res = await register({ ...valid, password });

      expectRejected(res, ["password"]);
      expect(res.body.fieldErrors.password).toContain(message);
      expect(await app.prisma.user.count()).toBe(0);
    });

    it("VAL-052: a password breaking every rule reports all of them at once", async () => {
      const res = await register({ ...valid, password: "!!!" });

      expect(res.body.fieldErrors.password).toEqual(expect.arrayContaining(PASSWORD_RULES.map(([, , message]) => message)));
    });

    it.each(withIds("VAL-061", "VAL-062", [
      ["an empty name", ""],
      ["a name of spaces only", "   "],
    ]))("%s: registering with %s answers 400 against name", async (_id, _case, name) => {
      expectRejected(await register({ ...valid, name }), ["name"]);
      expect(await app.prisma.user.count()).toBe(0);
    });

    it("VAL-063: email, name and password sent as numbers, booleans or objects answer 400 against each", async () => {
      expectRejected(await register({ email: 42, name: true, password: { x: 1 } }), ["email", "name", "password"]);
    });

    it("VAL-064: a 10 000-character name or email is answered with 201 or 400 — never a 500", async () => {
      const long = "a".repeat(10_000);
      for (const body of [{ ...valid, name: long }, { ...valid, email: `${long}@example.com` }]) {
        expect([201, 400]).toContain((await register(body)).status);
      }
    });
  });

  describe("POST /auth/login", () => {
    const login = (body: object) => request(app.server).post("/auth/login").send(body);

    it.each(withIds("VAL-084", "VAL-091", INVALID_EMAILS))("%s: signing in with the email %j answers 400 against email", async (_id, email) => {
      expectRejected(await login({ email, password: "anything" }), ["email"]);
    });

    it("VAL-092: an empty or missing password answers 400 against password", async () => {
      expectRejected(await login({ email: "ada@example.com", password: "" }), ["password"]);
      expectRejected(await login({ email: "ada@example.com" }), ["password"]);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it.each(withIds("VAL-109", "VAL-116", INVALID_EMAILS))("%s: asking for a reset link for %j answers 400 against email and sends nothing", async (_id, email) => {
      expectRejected(await request(app.server).post("/auth/forgot-password").send({ email }), ["email"]);
      expect(await app.prisma.passwordResetToken.count()).toBe(0);
    });
  });

  describe("POST /auth/reset-password", () => {
    beforeEach(() => createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD }));

    it("VAL-126: a missing or empty token answers 400 against token", async () => {
      for (const body of [{ password: "Abcdefghi1" }, { token: "", password: "Abcdefghi1" }]) {
        expectRejected(await request(app.server).post("/auth/reset-password").send(body), ["token"]);
      }
    });

    it.each(withIds("VAL-127", "VAL-130", PASSWORD_RULES))("%s: a new password with %s answers 400 with %j", async (_id, _case, password, message) => {
      const res = await request(app.server).post("/auth/reset-password").send({ token: "a".repeat(64), password });

      expectRejected(res, ["password"]);
      expect(res.body.fieldErrors.password).toContain(message);
    });
  });

  describe("PATCH /users/me", () => {
    let sam: string[];
    beforeEach(async () => {
      await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", name: "Sam", password: PASSWORD });
      sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
    });

    it.each(withIds("VAL-140", "VAL-144", [
      ["an empty name", { name: "" }, ["name"]],
      ["a name of spaces only", { name: "   " }, ["name"]],
      ["a 4-character phone", { phone: "1234" }, ["phone"]],
      ["a numeric phone", { phone: 380501234567 }, ["phone"]],
      ["an empty name and a short phone", { name: "", phone: "1" }, ["name", "phone"]],
    ]))("%s: %s answers 400 against that field and changes nothing", async (_id, _case, body, fields) => {
      expectRejected(await request(app.server).patch("/users/me").set("Cookie", sam).send(body), fields);
      expect(await app.prisma.user.findUniqueOrThrow({ where: { id: "usr_sam" } })).toMatchObject({ name: "Sam", phone: null });
    });
  });

  describe("POST and PATCH /users/me/addresses", () => {
    const valid = { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" };
    let sam: string[];
    beforeEach(async () => {
      await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD });
      sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
    });
    const create = (body: object) => request(app.server).post("/users/me/addresses").set("Cookie", sam).send(body);

    it.each(withIds("VAL-157", "VAL-161", ["label", "line1", "city", "postalCode", "country"]))("%s: creating an address with %s missing, empty or blank answers 400 against it and stores nothing", async (_id, field) => {
      const { [field as keyof typeof valid]: _drop, ...missing } = valid;
      for (const body of [missing, { ...valid, [field]: "" }, { ...valid, [field]: "   " }]) {
        expectRejected(await create(body), [field]);
      }
      expect(await app.prisma.address.count()).toBe(0);
    });

    it.each(withIds("VAL-162", "VAL-164", ["U", "UKR", "12"]))("%s: the country code %j answers 400 against country", async (_id, country) => {
      expectRejected(await create({ ...valid, country }), ["country"]);
    });

    it("VAL-165: an empty body answers 400 against all five fields", async () => {
      expectRejected(await create({}), ["city", "country", "label", "line1", "postalCode"]);
    });

    it("VAL-166: patching an address with an empty city or a bad country answers 400 and leaves it as it was", async () => {
      const created = await create(valid).expect(201);

      expectRejected(
        await request(app.server).patch(`/users/me/addresses/${created.body.id}`).set("Cookie", sam).send({ city: "", country: "UKR" }),
        ["city", "country"],
      );
      expect(await app.prisma.address.findUniqueOrThrow({ where: { id: created.body.id } })).toMatchObject({ city: "Kyiv", country: "UA" });
    });
  });

  describe("cart", () => {
    beforeEach(() => createProduct(app.prisma, { id: "prd_pen", name: "Pen", priceCents: 350 }));

    it.each(withIds("VAL-175", "VAL-180", [
      ["no productId", { quantity: 1 }, ["productId"]],
      ["an empty productId", { productId: "", quantity: 1 }, ["productId"]],
      ["quantity 0", { productId: "prd_pen", quantity: 0 }, ["quantity"]],
      ["quantity -1", { productId: "prd_pen", quantity: -1 }, ["quantity"]],
      ["quantity 1.5", { productId: "prd_pen", quantity: 1.5 }, ["quantity"]],
      ["quantity \"two\"", { productId: "prd_pen", quantity: "two" }, ["quantity"]],
    ]))("%s: adding to the cart with %s answers 400 against that field and creates no cart", async (_id, _case, body, fields) => {
      expectRejected(await request(app.server).post("/cart/items").send(body), fields);
      expect(await app.prisma.cart.count()).toBe(0);
    });

    it.each(withIds("VAL-186", "VAL-189", [[-1], [1.5], ["many"], [null]]))("%s: setting a line's quantity to %j answers 400 and leaves the line as it was", async (_id, quantity) => {
      const added = await request(app.server).post("/cart/items").send({ productId: "prd_pen", quantity: 2 }).expect(200);
      const cookie = (added.get("set-cookie") ?? []) as unknown as string[];

      expectRejected(await request(app.server).patch(`/cart/items/${added.body.lines[0].id}`).set("Cookie", cookie).send({ quantity }), ["quantity"]);
      expect((await app.prisma.cartLine.findUniqueOrThrow({ where: { id: added.body.lines[0].id } })).quantity).toBe(2);
    });
  });

  describe("GET /products", () => {
    it.each(withIds("VAL-201", "VAL-208", [
      ["page=0", "page"],
      ["page=-1", "page"],
      ["page=1.5", "page"],
      ["page=two", "page"],
      ["sort=newest", "sort"],
      ["minPrice=-1", "minPrice"],
      ["minPrice=9.99", "minPrice"],
      ["maxPrice=cheap", "maxPrice"],
    ]))("%s: ?%s answers 400 against that parameter", async (_id, query, field) => {
      expectRejected(await request(app.server).get(`/products?${query}`), [field]);
    });
  });

  describe("request shape", () => {
    it.each(withIds("VAL-209", "VAL-212", [
      ["a JSON array", "[]"],
      ["a JSON string", '"ada@example.com"'],
      ["JSON null", "null"],
      ["a JSON number", "42"],
    ]))("%s: a body that is %s instead of an object answers 400 in the error contract, never 500", async (_id, _case, body) => {
      const res = await request(app.server).post("/auth/register").set("Content-Type", "application/json").send(body);

      expect(res.status).toBe(400);
      expectErrorContract(res.body);
      expect(await app.prisma.user.count()).toBe(0);
    });

    it("VAL-213: a form-encoded body is validated exactly like JSON, and a text body answers 400 — never 500", async () => {
      const form = await request(app.server)
        .post("/auth/register")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("email=nope&name=&password=short");
      expectRejected(form, ["email", "name", "password"]);

      const text = await request(app.server).post("/auth/login").set("Content-Type", "text/plain").send("hello");
      expect(text.status).toBe(400);
      expectErrorContract(text.body);
      expect(await app.prisma.user.count()).toBe(0);
    });
  });
});
