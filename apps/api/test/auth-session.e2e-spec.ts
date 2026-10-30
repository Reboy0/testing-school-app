import request from "supertest";
import { createTestApp, TestApp } from "./setup";
import { createUser, loginAs } from "./factories";

describe("session lifecycle", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { email: "sam@example.com", password: "Password123!" });
  });

  it("LOGIN-040: rotates the refresh token", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const res = await request(app.server).post("/auth/refresh").set("Cookie", cookies).expect(200);
    const rotated = (res.get("set-cookie") ?? []).find((c) => c.startsWith("refresh_token="));
    expect(rotated).toBeDefined();
    expect(rotated).not.toEqual(cookies.find((c) => c.startsWith("refresh_token=")));
  });

  it("LOGIN-041: refuses an unknown refresh token", async () => {
    await request(app.server)
      .post("/auth/refresh")
      .set("Cookie", ["refresh_token=" + "0".repeat(64)])
      .expect(401);
  });

  it("LOGIN-042: clears cookies on logout", async () => {
    const { cookies } = await loginAs(app, "sam@example.com", "Password123!");
    const res = await request(app.server).post("/auth/logout").set("Cookie", cookies).expect(204);
    expect((res.get("set-cookie") ?? []).some((c) => c.startsWith("access_token=;"))).toBe(true);
  });
});
