import request from "supertest";
import { createTestApp, TestApp } from "./setup";

describe("GET /health", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());

  it("XC-033: reports ok", async () => {
    const res = await request(app.server).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
