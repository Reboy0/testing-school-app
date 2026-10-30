import request from "supertest";
import { createTestApp, TestApp } from "./setup";
import { clearMail, createUser, latestResetToken } from "./factories";

describe("password reset", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(async () => {
    await clearMail();
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { email: "sam@example.com", password: "Password123!" });
  });

  it("PWD-021: accepts a forgot-password request for a known address", async () => {
    await request(app.server).post("/auth/forgot-password").send({ email: "sam@example.com" }).expect(202);
    expect(await app.prisma.passwordResetToken.count()).toBe(1);
  });

  it("PWD-022: answers 202 for an unknown address without creating a token", async () => {
    await request(app.server).post("/auth/forgot-password").send({ email: "nobody@example.com" }).expect(202);
    expect(await app.prisma.passwordResetToken.count()).toBe(0);
  });

  it("PWD-023: resets the password with a valid token", async () => {
    await request(app.server).post("/auth/forgot-password").send({ email: "sam@example.com" }).expect(202);
    const token = await latestResetToken();
    await request(app.server)
      .post("/auth/reset-password")
      .send({ token, password: "BrandNewPass1" })
      .expect(204);
    await request(app.server)
      .post("/auth/login")
      .send({ email: "sam@example.com", password: "BrandNewPass1" })
      .expect(200);
  });

  it("PWD-024: rejects a token that was never issued", async () => {
    await request(app.server)
      .post("/auth/reset-password")
      .send({ token: "0".repeat(64), password: "BrandNewPass1" })
      .expect(400);
  });
});
