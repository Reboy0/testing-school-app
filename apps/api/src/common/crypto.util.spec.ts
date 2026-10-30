import { hashPassword, verifyPassword } from "./crypto.util";

describe("password hashing", () => {
  it("produces a hash that is not the plaintext", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toContain("Password123!");
  });

  it("verifies a correct password", async () => {
    expect(await verifyPassword("Password123!", await hashPassword("Password123!"))).toBe(true);
  });

  it("REG-05 U-AUTH-07: rejects an incorrect password", async () => {
    expect(await verifyPassword("WrongPassword1", await hashPassword("Password123!"))).toBe(false);
  });
});
