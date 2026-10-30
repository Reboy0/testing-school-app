/**
 * API cases A-USER-01 … A-USER-15 from docs/test-plan.md §6.2.
 */
import request from "supertest";
import { createUser, loginAs } from "./factories";
import { expectErrorContract } from "./plan-helpers";
import { createTestApp, TestApp } from "./setup";

const PASSWORD = "Password123!";

const home = { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" };
const work = { label: "Work", line1: "2 Khreshchatyk", city: "Kyiv", postalCode: "01002", country: "UA" };

interface AddressBody {
  id: string;
  label: string;
  isDefault: boolean;
}

describe("profile and addresses API (A-USER)", () => {
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

  const addAddress = (cookies: string[], body: object) =>
    request(app.server).post("/users/me/addresses").set("Cookie", cookies).send(body);
  const listAddresses = async (cookies: string[]): Promise<AddressBody[]> =>
    (await request(app.server).get("/users/me/addresses").set("Cookie", cookies).expect(200)).body;
  const defaults = (addresses: AddressBody[]) => addresses.filter((address) => address.isDefault);

  describe("profile", () => {
    it("PROF-001 A-USER-01: GET /users/me answers 200 with exactly id, email, name, phone, role and createdAt", async () => {
      const res = await request(app.server).get("/users/me").set("Cookie", sam).expect(200);

      expect(Object.keys(res.body).sort()).toEqual(["createdAt", "email", "id", "name", "phone", "role"]);
      expect(res.body).toMatchObject({ id: "usr_sam", email: "sam@example.com", name: "Sam", phone: null, role: "USER" });
    });

    it("PROF-002 A-USER-02: GET /users/me without signing in answers 401", async () => {
      const res = await request(app.server).get("/users/me").expect(401);

      expectErrorContract(res.body);
    });

    it("PROF-003 A-USER-03: GET /users/:id with your own id answers 200 with your own profile", async () => {
      const res = await request(app.server).get("/users/usr_sam").set("Cookie", sam).expect(200);

      expect(res.body).toMatchObject({ id: "usr_sam", email: "sam@example.com" });
    });

    it("PROF-004 A-USER-04: GET /users/:id with somebody else's id answers 403 and reveals nothing of theirs", async () => {
      const res = await request(app.server).get("/users/usr_dana").set("Cookie", sam);

      expect(res.status).toBe(403);
      expect(res.text).not.toContain("dana@example.com");
    });

    it("PROF-006 A-USER-05: PATCH /users/me with only phone changes phone and leaves name as it was", async () => {
      const res = await request(app.server).patch("/users/me").set("Cookie", sam).send({ phone: "+380501234567" }).expect(200);

      expect(res.body).toMatchObject({ phone: "+380501234567", name: "Sam" });
      const reread = await request(app.server).get("/users/me").set("Cookie", sam).expect(200);
      expect(reread.body).toMatchObject({ phone: "+380501234567", name: "Sam" });
    });

    it("PROF-007 A-USER-06: PATCH /users/me with an invalid value answers 400 against that field", async () => {
      const res = await request(app.server).patch("/users/me").set("Cookie", sam).send({ phone: "1" }).expect(400);

      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(res.body.fieldErrors).toEqual({ phone: ["Enter a valid phone number"] });
    });

    it("PROF-011 A-USER-07: PATCH /users/me cannot change email, role or id", async () => {
      await request(app.server)
        .patch("/users/me")
        .set("Cookie", sam)
        .send({ email: "evil@example.com", role: "ADMIN", id: "usr_evil" });

      const stored = await app.prisma.user.findUniqueOrThrow({ where: { id: "usr_sam" } });
      expect(stored).toMatchObject({ email: "sam@example.com", role: "USER" });
      expect(await app.prisma.user.count({ where: { id: "usr_evil" } })).toBe(0);
    });
  });

  describe("addresses", () => {
    it("PROF-013 A-USER-08: the first address created answers 201 and becomes the default", async () => {
      const res = await addAddress(sam, home).expect(201);

      expect(res.body).toMatchObject({ ...home, isDefault: true });
    });

    it("PROF-019 A-USER-09: creating a second address with isDefault makes it the one default and demotes the first", async () => {
      const first = await addAddress(sam, home).expect(201);
      const second = await addAddress(sam, { ...work, isDefault: true }).expect(201);

      const addresses = await listAddresses(sam);
      expect(defaults(addresses).map((address) => address.id)).toEqual([second.body.id]);
      expect(addresses.find((address) => address.id === first.body.id)?.isDefault).toBe(false);
    });

    it("PROF-020 A-USER-10: patching an existing address to default leaves exactly that one as the default", async () => {
      await addAddress(sam, home).expect(201);
      const second = await addAddress(sam, work).expect(201);

      await request(app.server)
        .patch(`/users/me/addresses/${second.body.id}`)
        .set("Cookie", sam)
        .send({ isDefault: true })
        .expect(200);

      expect(defaults(await listAddresses(sam)).map((address) => address.id)).toEqual([second.body.id]);
    });

    it("PROF-014 A-USER-11: deleting the default address answers 204 and leaves at most one default among the rest", async () => {
      const first = await addAddress(sam, home).expect(201);
      await addAddress(sam, work).expect(201);
      await addAddress(sam, { ...work, label: "Cottage" }).expect(201);

      await request(app.server).delete(`/users/me/addresses/${first.body.id}`).set("Cookie", sam).expect(204);

      const remaining = await listAddresses(sam);
      expect(remaining).toHaveLength(2);
      expect(defaults(remaining).length).toBeLessThanOrEqual(1);
    });

    it("PROF-023 A-USER-12: each of two users lists only their own addresses", async () => {
      await addAddress(sam, home).expect(201);
      await addAddress(dana, work).expect(201);

      expect((await listAddresses(sam)).map((address) => address.label)).toEqual(["Home"]);
      expect((await listAddresses(dana)).map((address) => address.label)).toEqual(["Work"]);
    });

    it("PROF-024 A-USER-13: patching or deleting somebody else's address is refused and leaves it as it was", async () => {
      const samsHome = await addAddress(sam, home).expect(201);

      const patched = await request(app.server)
        .patch(`/users/me/addresses/${samsHome.body.id}`)
        .set("Cookie", dana)
        .send({ label: "Hacked" });
      const deleted = await request(app.server).delete(`/users/me/addresses/${samsHome.body.id}`).set("Cookie", dana);

      expect([403, 404]).toContain(patched.status);
      expect([403, 404]).toContain(deleted.status);
      expect(await listAddresses(sam)).toEqual([samsHome.body]);
    });

    it("PROF-015 A-USER-14: patching or deleting an address id that does not exist answers 404 in the error contract", async () => {
      const patched = await request(app.server).patch("/users/me/addresses/adr_missing").set("Cookie", sam).send({ label: "X" });
      const deleted = await request(app.server).delete("/users/me/addresses/adr_missing").set("Cookie", sam);

      expect(patched.status).toBe(404);
      expect(deleted.status).toBe(404);
      expectErrorContract(patched.body);
      expectErrorContract(deleted.body);
    });

    it("PROF-016 A-USER-15: creating an address with invalid fields answers 400 with an error against each one", async () => {
      const res = await addAddress(sam, { label: "", line1: "", city: "", postalCode: "", country: "Ukraine" }).expect(400);

      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["city", "country", "label", "line1", "postalCode"]);
      expect(await listAddresses(sam)).toEqual([]);
    });
  });
});
