import { TestApp, createTestApp } from "../../fixture/app";
import { createUser } from "../../fixture/seed";

describe("POST /auth/login", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { email: "sam@example.com", password: "Password123!" });
  });

  it("LOGIN-038: signs in with correct credentials", async () => {
    const res = await app.api
      .post("/auth/login")
      .send({ email: "sam@example.com", password: "Password123!" })
      .expect(200);
    expect((res.get("set-cookie") ?? []).some((c) => c.startsWith("access_token="))).toBe(true);
  });

  it("LOGIN-039: rejects a wrong password with 401", async () => {
    await app.api
      .post("/auth/login")
      .send({ email: "sam@example.com", password: "WrongPassword1" })
      .expect(401);
  });
});
