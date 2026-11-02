import { TestApp, createTestApp } from "../../fixture/app";

describe("GET /health", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());

  it("XC-033: reports ok", async () => {
    const res = await app.api.get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
