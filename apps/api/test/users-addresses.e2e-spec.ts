import request from "supertest";
import { createTestApp, TestApp } from "./setup";
import { createUser, loginAs } from "./factories";

describe("addresses", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: "Password123!" });
    await createUser(app.prisma, { id: "usr_dana", email: "dana@example.com", password: "Password123!" });
  });

  const homeAddress = {
    label: "Home",
    line1: "1 Main St",
    city: "Zurich",
    postalCode: "8000",
    country: "CH",
  };

  const workAddress = {
    label: "Work",
    line1: "2 Bahnhofstrasse",
    city: "Zurich",
    postalCode: "8001",
    country: "CH",
  };

  it("PROF-027: lists only your own addresses", async () => {
    const sam = await loginAs(app, "sam@example.com", "Password123!");
    const dana = await loginAs(app, "dana@example.com", "Password123!");
    await request(app.server).post("/users/me/addresses").set("Cookie", sam.cookies).send(homeAddress).expect(201);
    await request(app.server).post("/users/me/addresses").set("Cookie", dana.cookies).send(workAddress).expect(201);

    const res = await request(app.server).get("/users/me/addresses").set("Cookie", sam.cookies).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe("Home");
  });

  it("PROF-028: makes the first address the default", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const res = await request(app.server)
      .post("/users/me/addresses")
      .set("Cookie", cookies)
      .send(homeAddress)
      .expect(201);
    expect(res.body.isDefault).toBe(true);
  });

  it("PROF-029: demotes the previous default when a second address is created as default", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const first = await request(app.server)
      .post("/users/me/addresses")
      .set("Cookie", cookies)
      .send(homeAddress)
      .expect(201);
    const second = await request(app.server)
      .post("/users/me/addresses")
      .set("Cookie", cookies)
      .send({ ...workAddress, isDefault: true })
      .expect(201);

    const res = await request(app.server).get("/users/me/addresses").set("Cookie", cookies).expect(200);
    const updatedFirst = res.body.find((address: { id: string }) => address.id === first.body.id);
    const updatedSecond = res.body.find((address: { id: string }) => address.id === second.body.id);
    expect(updatedFirst.isDefault).toBe(false);
    // USER-04: "at most one default address" is only half the clause. Asserting
    // the demotion alone would still pass if the new address never became the
    // default either, leaving the user with none.
    expect(updatedSecond.isDefault).toBe(true);
    expect(res.body.filter((address: { isDefault: boolean }) => address.isDefault)).toHaveLength(1);
  });

  it("PROF-030: refuses to update an address you do not own", async () => {
    const sam = await loginAs(app, "sam@example.com", "Password123!");
    const dana = await loginAs(app, "dana@example.com", "Password123!");
    const created = await request(app.server)
      .post("/users/me/addresses")
      .set("Cookie", sam.cookies)
      .send(homeAddress)
      .expect(201);

    const res = await request(app.server)
      .patch(`/users/me/addresses/${created.body.id}`)
      .set("Cookie", dana.cookies)
      .send({ label: "Hacked" })
      .expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("PROF-031: deletes an address", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const created = await request(app.server)
      .post("/users/me/addresses")
      .set("Cookie", cookies)
      .send(homeAddress)
      .expect(201);

    await request(app.server).delete(`/users/me/addresses/${created.body.id}`).set("Cookie", cookies).expect(204);

    const res = await request(app.server).get("/users/me/addresses").set("Cookie", cookies).expect(200);
    expect(res.body).toHaveLength(0);
  });
});
