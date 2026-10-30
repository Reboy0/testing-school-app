/**
 * Cross-cutting API cases from docs/test-plan.md §6.8: the error contract,
 * security and the health check.
 */
import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { CatalogService } from "../src/catalog/catalog.service";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter";
import { createCategory, createProduct, createUser, loginAs } from "./factories";
import { expectErrorContract, setCookie, setCookies } from "./plan-helpers";
import { createTestApp, TestApp } from "./setup";

const PASSWORD = "Password123!";

describe("cross-cutting API (A-ERR, A-SEC, A-HEALTH)", () => {
  let app: TestApp;
  let sam: string[];

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
    await createCategory(app.prisma, { id: "cat_toys", slug: "toys", name: "Toys" });
    await createProduct(app.prisma, { id: "prd_a", name: "Product A", priceCents: 1000, categoryIds: ["cat_toys"] });
    sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
  });

  afterEach(() => {
    delete process.env.CROSS_SITE_COOKIES;
  });

  describe("error contract", () => {
    it("XC-05 A-ERR-01: a malformed JSON body answers 400 with {code, message, fieldErrors: null}", async () => {
      const res = await request(app.server)
        .post("/auth/register")
        .set("Content-Type", "application/json")
        .send('{"email": ')
        .expect(400);

      expectErrorContract(res.body);
      expect(res.body.fieldErrors).toBeNull();
    });

    it("XC-05 A-ERR-02: every endpoint that takes a body answers a validation failure with 400 VALIDATION_FAILED and fieldErrors keyed by field", async () => {
      const cases: [() => request.Test, string][] = [
        [() => request(app.server).post("/auth/register").send({ email: "x" }), "email"],
        [() => request(app.server).post("/auth/login").send({ email: "x" }), "email"],
        [() => request(app.server).post("/auth/forgot-password").send({ email: "x" }), "email"],
        [() => request(app.server).post("/auth/reset-password").send({ token: "", password: "x" }), "token"],
        [() => request(app.server).patch("/users/me").set("Cookie", sam).send({ phone: "1" }), "phone"],
        [() => request(app.server).post("/users/me/addresses").set("Cookie", sam).send({ label: "" }), "label"],
        [() => request(app.server).post("/cart/items").send({ productId: "prd_a", quantity: 0 }), "quantity"],
        [() => request(app.server).patch("/cart/items/any").send({ quantity: -1 }), "quantity"],
      ];

      for (const [send, field] of cases) {
        const res = await send();
        expect(res.status).toBe(400);
        expectErrorContract(res.body);
        expect(res.body.code).toBe("VALIDATION_FAILED");
        expect(res.body.fieldErrors[field]).toEqual(expect.arrayContaining([expect.any(String)]));
      }
    });

    it("XC-05 A-ERR-04: a route that does not exist answers 404 in the error contract", async () => {
      const res = await request(app.server).get("/no/such/route").expect(404);

      expectErrorContract(res.body);
      expect(res.body.fieldErrors).toBeNull();
    });
  });

  describe("security", () => {
    it("XC-06 A-SEC-01: every cookie — session and cart — is HttpOnly, SameSite=Lax same-site and SameSite=None; Secure cross-site", async () => {
      for (const crossSite of [false, true]) {
        if (crossSite) process.env.CROSS_SITE_COOKIES = "true";
        else delete process.env.CROSS_SITE_COOKIES;

        const cart = await request(app.server).post("/cart/items").send({ productId: "prd_a" }).expect(200);
        const signedIn = await request(app.server)
          .post("/auth/login")
          .send({ email: "sam@example.com", password: PASSWORD })
          .expect(200);
        const cookies = [setCookie(cart, "cart_token"), ...setCookies(signedIn)];

        expect(cookies).toHaveLength(3);
        for (const cookie of cookies) {
          expect(cookie).toMatch(/;\s*HttpOnly/i);
          if (crossSite) {
            expect(cookie).toMatch(/;\s*SameSite=None/i);
            expect(cookie).toMatch(/;\s*Secure/i);
          } else {
            expect(cookie).toMatch(/;\s*SameSite=Lax/i);
            expect(cookie).not.toMatch(/;\s*Secure/i);
          }
        }
      }
    });

    it("XC-07 A-SEC-02: SQL and NoSQL injections in search, filters and path ids answer 200, 400 or 404 — never 500, never extra data", async () => {
      const payloads = ["' OR 1=1 --", "'; DROP TABLE \"User\"; --", '{"$ne": null}', "%' OR '%'='"];

      for (const payload of payloads) {
        const encoded = encodeURIComponent(payload);
        for (const path of [`/products?q=${encoded}`, `/products?category=${encoded}`]) {
          const res = await request(app.server).get(path);
          expect([200, 400]).toContain(res.status);
          if (res.status === 200) expect(res.body.items).toEqual([]);
        }
        for (const send of [
          () => request(app.server).get(`/users/${encoded}`).set("Cookie", sam),
          () => request(app.server).patch(`/users/me/addresses/${encoded}`).set("Cookie", sam).send({ label: "X" }),
          () => request(app.server).patch(`/cart/items/${encoded}`).set("Cookie", sam).send({ quantity: 1 }),
        ]) {
          const res = await send();
          expect(res.status).toBeLessThan(500);
          expect(res.text).not.toContain("passwordHash");
        }
      }

      expect(await app.prisma.user.count()).toBe(1);
    });

    it("XC-07 A-SEC-03: script in a name or an address is stored and served back verbatim as JSON data, not markup", async () => {
      const script = `<script>alert("xss")</script><img src=x onerror=alert(1)>`;

      await request(app.server).patch("/users/me").set("Cookie", sam).send({ name: script }).expect(200);
      await request(app.server)
        .post("/users/me/addresses")
        .set("Cookie", sam)
        .send({ label: script, line1: script, city: "Kyiv", postalCode: "01001", country: "UA" })
        .expect(201);

      const me = await request(app.server).get("/users/me").set("Cookie", sam).expect(200);
      const addresses = await request(app.server).get("/users/me/addresses").set("Cookie", sam).expect(200);
      expect(me.get("content-type")).toMatch(/^application\/json/);
      expect(me.body.name).toBe(script);
      expect(addresses.body[0]).toMatchObject({ label: script, line1: script });
    });
  });

  it("XC-10 A-HEALTH-01: GET /health answers 200 ok", async () => {
    const res = await request(app.server).get("/health").expect(200);

    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("unexpected server errors (A-ERR-03)", () => {
  let nest: INestApplication;

  beforeAll(async () => {
    jest
      .spyOn(CatalogService.prototype, "list")
      .mockRejectedValue(new Error("connect ECONNREFUSED postgres://school:hunter2@db:5432/school"));
    nest = await NestFactory.create(AppModule, { logger: false });
    nest.use(cookieParser());
    nest.useGlobalFilters(new AllExceptionsFilter());
    await nest.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await nest.close();
  });

  it("XC-05 A-ERR-03: an unexpected failure answers 500 in the same error contract, without the exception's details", async () => {
    const res = await request(nest.getHttpServer()).get("/products").expect(500);

    expectErrorContract(res.body);
    expect(res.body).toEqual({ code: "INTERNAL_ERROR", message: "Something went wrong", fieldErrors: null });
    expect(res.text).not.toMatch(/hunter2|ECONNREFUSED|postgres:\/\//);
  });
});
