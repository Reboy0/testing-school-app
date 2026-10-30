/**
 * OpenCards suite «API»: /users/me, /users/:id and /users/me/addresses,
 * API-16 … API-30.
 */
import request from "supertest";
import { createUser, loginAs } from "../factories";
import { expectErrorContract } from "../plan-helpers";
import { createTestApp, TestApp } from "../setup";

const PASSWORD = "Password123!";
const home = { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" };

describe("API suite: /users", () => {
  let app: TestApp;
  let sam: string[];
  let dana: string[];

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", name: "Sam", password: PASSWORD });
    await createUser(app.prisma, { id: "usr_dana", email: "dana@example.com", name: "Dana", password: PASSWORD });
    sam = (await loginAs(app, "sam@example.com", PASSWORD)).cookies;
    dana = (await loginAs(app, "dana@example.com", PASSWORD)).cookies;
  });

  const as = (cookies: string[]) => ({
    get: (path: string) => request(app.server).get(path).set("Cookie", cookies),
    patch: (path: string, body: object) => request(app.server).patch(path).set("Cookie", cookies).send(body),
    post: (path: string, body: object) => request(app.server).post(path).set("Cookie", cookies).send(body),
    delete: (path: string) => request(app.server).delete(path).set("Cookie", cookies),
  });

  describe("GET /users/me", () => {
    it("API-16: answers 200 with exactly id, email, name, phone, role and createdAt as an ISO date", async () => {
      const res = await as(sam).get("/users/me").expect(200);

      expect(res.body).toEqual({
        id: "usr_sam",
        email: "sam@example.com",
        name: "Sam",
        phone: null,
        role: "USER",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });

    it("API-17: without a session answers 401 UNAUTHENTICATED", async () => {
      const res = await request(app.server).get("/users/me").expect(401);

      expect(res.body).toEqual({ code: "UNAUTHENTICATED", message: "Sign in to continue", fieldErrors: null });
    });
  });

  describe("PATCH /users/me", () => {
    it("API-18: answers 200 with the updated profile, changing only the fields sent", async () => {
      const res = await as(sam).patch("/users/me", { name: "Samuel" }).expect(200);

      expect(res.body).toMatchObject({ id: "usr_sam", name: "Samuel", phone: null, email: "sam@example.com" });
    });

    it("API-19: an empty name or a too-short phone answers 400 against that field", async () => {
      const res = await as(sam).patch("/users/me", { name: "", phone: "12" }).expect(400);

      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["name", "phone"]);
    });

    it("API-20: email, role and id in the body are ignored", async () => {
      const res = await as(sam).patch("/users/me", { name: "Sam", email: "x@example.com", role: "ADMIN", id: "usr_x" }).expect(200);

      expect(res.body).toMatchObject({ id: "usr_sam", email: "sam@example.com", role: "USER" });
    });
  });

  describe("GET /users/:id", () => {
    it("API-21: your own id answers 200 with your profile", async () => {
      const res = await as(sam).get("/users/usr_sam").expect(200);

      expect(res.body.email).toBe("sam@example.com");
    });

    it("API-22: another user's id answers 403 and none of their data", async () => {
      const res = await as(sam).get("/users/usr_dana");

      expect(res.status).toBe(403);
      expectErrorContract(res.body);
      expect(res.text).not.toContain("dana@example.com");
    });
  });

  describe("/users/me/addresses", () => {
    it("API-23: GET answers 200 with only the caller's addresses", async () => {
      await as(sam).post("/users/me/addresses", home).expect(201);
      await as(dana).post("/users/me/addresses", { ...home, label: "Dana's" }).expect(201);

      const res = await as(sam).get("/users/me/addresses").expect(200);
      expect(res.body.map((address: { label: string }) => address.label)).toEqual(["Home"]);
    });

    it("API-24: POST answers 201 with the stored address, made the default when it is the first", async () => {
      const res = await as(sam).post("/users/me/addresses", home).expect(201);

      expect(res.body).toMatchObject({ ...home, isDefault: true, userId: "usr_sam" });
      expect(typeof res.body.id).toBe("string");
    });

    it("API-25: POST with invalid fields answers 400 against each one and stores nothing", async () => {
      const res = await as(sam).post("/users/me/addresses", { ...home, city: "", country: "UKR" }).expect(400);

      expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["city", "country"]);
      expect(await app.prisma.address.count()).toBe(0);
    });

    it("API-26: PATCH answers 200 with the change applied, and isDefault leaves it the only default", async () => {
      await as(sam).post("/users/me/addresses", home).expect(201);
      const second = await as(sam).post("/users/me/addresses", { ...home, label: "Work" }).expect(201);

      const res = await as(sam).patch(`/users/me/addresses/${second.body.id}`, { city: "Lviv", isDefault: true }).expect(200);

      expect(res.body).toMatchObject({ city: "Lviv", isDefault: true });
      const defaults = (await as(sam).get("/users/me/addresses").expect(200)).body.filter((a: { isDefault: boolean }) => a.isDefault);
      expect(defaults.map((a: { id: string }) => a.id)).toEqual([second.body.id]);
    });

    it("API-27: PATCH of somebody else's address is refused and changes nothing", async () => {
      const samsHome = await as(sam).post("/users/me/addresses", home).expect(201);

      const res = await as(dana).patch(`/users/me/addresses/${samsHome.body.id}`, { label: "Mine now" });

      expect([403, 404]).toContain(res.status);
      expect((await app.prisma.address.findUniqueOrThrow({ where: { id: samsHome.body.id } })).label).toBe("Home");
    });

    it("API-28: DELETE of your own address answers 204 and removes it", async () => {
      const created = await as(sam).post("/users/me/addresses", home).expect(201);

      await as(sam).delete(`/users/me/addresses/${created.body.id}`).expect(204);

      expect(await app.prisma.address.count()).toBe(0);
    });

    it("API-29: DELETE of an address id that does not exist answers 404", async () => {
      const res = await as(sam).delete("/users/me/addresses/adr_missing");

      expect(res.status).toBe(404);
      expectErrorContract(res.body);
    });

    it("API-30: every address endpoint answers 401 without a session", async () => {
      for (const send of [
        () => request(app.server).get("/users/me/addresses"),
        () => request(app.server).post("/users/me/addresses").send(home),
        () => request(app.server).patch("/users/me/addresses/any").send({ label: "X" }),
        () => request(app.server).delete("/users/me/addresses/any"),
      ]) {
        expect((await send()).status).toBe(401);
      }
    });
  });
});
