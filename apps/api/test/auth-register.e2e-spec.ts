import request from "supertest";
import { createTestApp, TestApp } from "./setup";

describe("POST /auth/register", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(() => app.prisma.user.deleteMany());

  const body = { email: "new@example.com", password: "Password123!", name: "New User" };

  it("REG-031: creates an account and sets both cookies", async () => {
    const res = await request(app.server).post("/auth/register").send(body).expect(201);
    const cookies = res.get("set-cookie") ?? [];
    expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
    expect(cookies.every((c) => c.includes("HttpOnly"))).toBe(true);
  });

  it("REG-032: never returns the password hash", async () => {
    const res = await request(app.server).post("/auth/register").send(body).expect(201);
    expect(JSON.stringify(res.body)).not.toContain("$2");
  });

  it("REG-033: rejects a duplicate email with 409", async () => {
    await request(app.server).post("/auth/register").send(body).expect(201);
    const res = await request(app.server).post("/auth/register").send(body).expect(409);
    expect(res.body.code).toBe("EMAIL_TAKEN");
  });

  it("REG-034: returns per-field errors for a weak password", async () => {
    const res = await request(app.server)
      .post("/auth/register")
      .send({ ...body, password: "weak" })
      .expect(400);
    expect(res.body.fieldErrors.password.length).toBeGreaterThan(0);
  });
});
