import { loginAs } from "../../client/requests";
import { TestApp, createTestApp } from "../../fixture/app";
import { createUser } from "../../fixture/seed";

describe("profile", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: "Password123!" });
    await createUser(app.prisma, { id: "usr_dana", email: "dana@example.com", password: "Password123!" });
  });

  it("PROF-032: returns the signed-in user's profile without the hash", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const res = await app.api.get("/users/me").set("Cookie", cookies).expect(200);
    expect(res.body.email).toBe("sam@example.com");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("PROF-033: refuses an unauthenticated request", async () => {
    await app.api.get("/users/me").expect(401);
  });

  it("PROF-034: updates only the supplied fields", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    await app.api.patch("/users/me").set("Cookie", cookies).send({ phone: "+41 44 000" }).expect(200);
    const res = await app.api.get("/users/me").set("Cookie", cookies).expect(200);
    expect(res.body.phone).toBe("+41 44 000");
    expect(res.body.name).toBe("Test User");
  });

  it("PROF-035: returns your own profile by id", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    await app.api.get("/users/usr_sam").set("Cookie", cookies).expect(200);
  });
});
