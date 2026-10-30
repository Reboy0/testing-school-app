import { generateToken, hashToken, computeExpiry } from "./token.util";

describe("token utilities", () => {
  it("LOGIN-04 U-AUTH-11: generates a 64-character hex token", () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("LOGIN-04 U-AUTH-11: generates a different token each call", () => {
    expect(generateToken()).not.toEqual(generateToken());
  });

  it("LOGIN-04 U-AUTH-11: hashes deterministically", () => {
    expect(hashToken("abc")).toEqual(hashToken("abc"));
    expect(hashToken("abc")).not.toEqual(hashToken("abd"));
  });

  it("returns a Date in the future", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(computeExpiry(15, now).getTime()).toBeGreaterThan(now.getTime());
  });
});
