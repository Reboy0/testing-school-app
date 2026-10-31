import request from "supertest";
import { createTestApp, TestApp } from "./setup";

/**
 * `docs/testing-guide.md` promises that *every* error response from the API
 * has the same shape: `{ code, message, fieldErrors }`. The easiest place for
 * that promise to break is a request that never reaches a controller at all —
 * a malformed JSON body fails inside Express's body-parser middleware, before
 * any Nest route, pipe or exception filter is involved. Nothing else in the
 * suite sends a request that fails that early, so nothing else would notice if
 * such a request started returning a bare framework error page or a stack
 * trace instead of the documented envelope.
 */
describe("error contract", () => {
  let app: TestApp;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());

  it("XC-032: returns the documented error envelope for a malformed JSON body", async () => {
    const res = await request(app.server)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "sam@example.com",')
      .expect(400);

    expect(res.get("content-type")).toMatch(/application\/json/);
    expect(Object.keys(res.body).sort()).toEqual(["code", "fieldErrors", "message"]);
    expect(typeof res.body.code).toBe("string");
    expect(res.body.code.length).toBeGreaterThan(0);
    expect(typeof res.body.message).toBe("string");
    expect(res.body.fieldErrors).toBeNull();

    // No HTML error page, and no internals: a body-parse failure must not
    // hand the caller a stack trace or a filesystem path.
    expect(res.text).not.toMatch(/<html/i);
    expect(res.text).not.toContain("    at ");
    expect(res.text).not.toContain("node_modules");
  });
});
