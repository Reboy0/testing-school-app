import { registerSchema } from "./auth";
import { withIds } from "./testing/ids";

describe("registerSchema", () => {
  const valid = { email: "a@b.com", password: "Password123!", name: "Ada" };

  it("VAL-241: accepts a compliant registration", () => {
    expect(registerSchema.parse(valid)).toEqual(valid);
  });

  it.each(withIds("VAL-242", "VAL-245", [
    ["Short1!", "shorter than 10 characters"],
    ["alllowercase1", "no uppercase letter"],
    ["ALLUPPERCASE1", "no lowercase letter"],
    ["NoDigitsHere!", "no digit"],
  ]))("%s: rejects %s (%s)", (_id, password, _reason) => {
    const result = registerSchema.safeParse({ ...valid, password });
    expect(result.success).toBe(false);
  });

  it("VAL-246: rejects a malformed email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });
});
