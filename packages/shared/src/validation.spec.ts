/**
 * OpenCards suite «Валідація» (prefix VAL), unit level: every rule of every
 * shared schema, one invalid value at a time against an otherwise valid
 * input, so each failure names exactly the field and the rule it broke.
 */
import {
  addressInputSchema,
  addToCartSchema,
  catalogueQuerySchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateCartLineSchema,
  updateProfileSchema,
} from "./index";
import { withIds } from "./testing/ids";

type Schema = { safeParse(input: unknown): { success: boolean; error?: { flatten(): { fieldErrors: Record<string, string[] | undefined> } } } };

/** The fields a value was rejected against (empty when it was accepted). */
const rejected = (schema: Schema, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : Object.keys(result.error!.flatten().fieldErrors);
};

const INVALID_EMAILS = [
  "",
  " ",
  "plainaddress",
  "a@",
  "@example.com",
  "ada@",
  "ada@example",
  "ada example@example.com",
  "ada@exa mple.com",
  "ada@@example.com",
  ".ada@example.com",
  "ada.@example.com",
  "ada..lovelace@example.com",
  "ada@example..com",
  "<script>@example.com",
];
const VALID_EMAILS = ["ada@example.com", "ada.lovelace@example.co.uk", "ada+shop@example.com", "ADA@EXAMPLE.COM", "a1@b2.io"];
const NOT_A_STRING = [null, 42, true, {}, []];

const PASSWORD_RULES: [string, string, string][] = [
  ["9 characters", "Abcdefgh1", "Password must be at least 10 characters"],
  ["no uppercase letter", "abcdefghi1", "Password must contain an uppercase letter"],
  ["no lowercase letter", "ABCDEFGHI1", "Password must contain a lowercase letter"],
  ["no digit", "Abcdefghij", "Password must contain a digit"],
  ["only spaces", "          ", "Password must contain an uppercase letter"],
];

describe("registerSchema", () => {
  const valid = { email: "ada@example.com", name: "Ada", password: "Abcdefghi1" };

  it.each(withIds("VAL-001", "VAL-015", INVALID_EMAILS))("%s: the email %j is rejected against email", (_id, email) => {
    expect(rejected(registerSchema, { ...valid, email })).toEqual(["email"]);
  });

  it.each(withIds("VAL-016", "VAL-020", VALID_EMAILS))("%s: the email %j is accepted", (_id, email) => {
    expect(rejected(registerSchema, { ...valid, email })).toEqual([]);
  });

  it.each(withIds("VAL-021", "VAL-025", NOT_A_STRING))("%s: an email that is %j rather than text is rejected against email", (_id, email) => {
    expect(rejected(registerSchema, { ...valid, email })).toEqual(["email"]);
  });

  it.each(withIds("VAL-034", "VAL-038", PASSWORD_RULES))("%s: a password with %s is rejected with %j", (_id, _case, password, message) => {
    const result = registerSchema.safeParse({ ...valid, password });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.flatten().fieldErrors.password).toContain(message);
  });

  it.each(withIds("VAL-039", "VAL-042", [
    ["exactly 10 characters", "Abcdefghi1"],
    ["a symbol in it", "Abcdefgh1!"],
    ["Unicode letters", "Пароль1Abc"],
    ["128 characters", `Aa1${"x".repeat(125)}`],
  ]))("%s: a password of %s that meets every rule is accepted", (_id, _case, password) => {
    expect(rejected(registerSchema, { ...valid, password })).toEqual([]);
  });

  it.each(withIds("VAL-043", "VAL-047", NOT_A_STRING))("%s: a password that is %j rather than text is rejected against password", (_id, password) => {
    expect(rejected(registerSchema, { ...valid, password })).toEqual(["password"]);
  });

  it.each(withIds("VAL-053", "VAL-055", [
    ["empty", ""],
    ["only spaces", "   "],
    ["a tab and a newline", "\t\n"],
  ]))("%s: a name that is %s is rejected against name", (_id, _case, name) => {
    expect(rejected(registerSchema, { ...valid, name })).toEqual(["name"]);
  });

  it.each(withIds("VAL-056", "VAL-060", NOT_A_STRING))("%s: a name that is %j rather than text is rejected against name", (_id, name) => {
    expect(rejected(registerSchema, { ...valid, name })).toEqual(["name"]);
  });
});

describe("loginSchema", () => {
  const valid = { email: "ada@example.com", password: "anything" };

  it.each(withIds("VAL-065", "VAL-079", INVALID_EMAILS))("%s: signing in with the email %j is rejected against email", (_id, email) => {
    expect(rejected(loginSchema, { ...valid, email })).toEqual(["email"]);
  });

  it.each(withIds("VAL-080", "VAL-082", [["", "empty"], [null, "null"], [undefined, "missing"]]))("%s: a password that is %j (%s) is rejected against password", (_id, password, _what) => {
    expect(rejected(loginSchema, { ...valid, password })).toEqual(["password"]);
  });

  it("VAL-083: sign-in does not apply the registration password rules — a short password is checked by the server, not refused by the schema", () => {
    expect(rejected(loginSchema, { ...valid, password: "x" })).toEqual([]);
  });
});

describe("forgotPasswordSchema", () => {
  it.each(withIds("VAL-093", "VAL-107", INVALID_EMAILS))("%s: asking for a reset link for %j is rejected against email", (_id, email) => {
    expect(rejected(forgotPasswordSchema, { email })).toEqual(["email"]);
  });

  it("VAL-108: a missing email is rejected against email", () => {
    expect(rejected(forgotPasswordSchema, {})).toEqual(["email"]);
  });
});

describe("resetPasswordSchema", () => {
  const valid = { token: "a".repeat(64), password: "Abcdefghi1" };

  it.each(withIds("VAL-117", "VAL-120", [["", "empty"], [null, "null"], [undefined, "missing"], [42, "a number"]]))("%s: a token that is %j (%s) is rejected against token", (_id, token, _what) => {
    expect(rejected(resetPasswordSchema, { ...valid, token })).toEqual(["token"]);
  });

  it.each(withIds("VAL-121", "VAL-125", PASSWORD_RULES))("%s: a new password with %s is rejected with %j", (_id, _case, password, message) => {
    const result = resetPasswordSchema.safeParse({ ...valid, password });

    expect(result.success ? [] : result.error.flatten().fieldErrors.password).toContain(message);
  });
});

describe("updateProfileSchema", () => {
  it.each(withIds("VAL-131", "VAL-136", [
    ["an empty name", { name: "" }, "name"],
    ["a name of spaces only", { name: "   " }, "name"],
    ["a name that is a number", { name: 42 }, "name"],
    ["a 4-character phone", { phone: "1234" }, "phone"],
    ["an empty phone", { phone: "" }, "phone"],
    ["a phone that is a number", { phone: 380501234567 }, "phone"],
  ]))("%s: %s is rejected against that field", (_id, _case, input, field) => {
    expect(rejected(updateProfileSchema, input)).toEqual([field]);
  });

  it.each(withIds("VAL-137", "VAL-139", [
    ["a 5-character phone", { phone: "12345" }],
    ["an international phone", { phone: "+380 50 123 45 67" }],
    ["a one-letter name", { name: "A" }],
  ]))("%s: %s is accepted", (_id, _case, input) => {
    expect(rejected(updateProfileSchema, input)).toEqual([]);
  });
});

describe("addressInputSchema", () => {
  const valid = { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" };

  it.each(withIds("VAL-145", "VAL-149", ["label", "line1", "city", "postalCode", "country"]))("%s: a missing, empty, blank or non-text %s is rejected against it", (_id, field) => {
    const { [field as keyof typeof valid]: _drop, ...missing } = valid;
    for (const input of [missing, { ...valid, [field]: "" }, { ...valid, [field]: "   " }, { ...valid, [field]: 7 }]) {
      expect(rejected(addressInputSchema, input)).toEqual([field]);
    }
  });

  it.each(withIds("VAL-150", "VAL-155", ["U", "UKR", "1", "U A", "ua1", "12"]))("%s: the country code %j is not two letters and is rejected", (_id, country) => {
    expect(rejected(addressInputSchema, { ...valid, country })).toEqual(["country"]);
  });

  it("VAL-156: isDefault must be a boolean when sent", () => {
    expect(rejected(addressInputSchema, { ...valid, isDefault: "yes" })).toEqual(["isDefault"]);
    expect(rejected(addressInputSchema, { ...valid, isDefault: true })).toEqual([]);
  });
});

describe("addToCartSchema", () => {
  it.each(withIds("VAL-167", "VAL-174", [
    ["no productId", { quantity: 1 }, "productId"],
    ["an empty productId", { productId: "", quantity: 1 }, "productId"],
    ["a numeric productId", { productId: 7, quantity: 1 }, "productId"],
    ["quantity 0", { productId: "prd_1", quantity: 0 }, "quantity"],
    ["quantity -1", { productId: "prd_1", quantity: -1 }, "quantity"],
    ["quantity 1.5", { productId: "prd_1", quantity: 1.5 }, "quantity"],
    ["quantity \"two\"", { productId: "prd_1", quantity: "two" }, "quantity"],
    ["quantity null", { productId: "prd_1", quantity: null }, "quantity"],
  ]))("%s: %s is rejected against that field", (_id, _case, input, field) => {
    expect(rejected(addToCartSchema, input)).toEqual([field]);
  });
});

describe("updateCartLineSchema", () => {
  it.each(withIds("VAL-181", "VAL-185", [[-1], [1.5], ["many"], [undefined], [null]]))("%s: quantity %j is rejected against quantity", (_id, quantity) => {
    expect(rejected(updateCartLineSchema, { quantity })).toEqual(["quantity"]);
  });
});

describe("catalogueQuerySchema", () => {
  it.each(withIds("VAL-190", "VAL-200", [
    ["page=0", { page: "0" }, "page"],
    ["page=-1", { page: "-1" }, "page"],
    ["page=1.5", { page: "1.5" }, "page"],
    ["page=two", { page: "two" }, "page"],
    ["sort=newest", { sort: "newest" }, "sort"],
    ["sort=PRICE_ASC", { sort: "PRICE_ASC" }, "sort"],
    ["minPrice=-1", { minPrice: "-1" }, "minPrice"],
    ["minPrice=9.99", { minPrice: "9.99" }, "minPrice"],
    ["minPrice=cheap", { minPrice: "cheap" }, "minPrice"],
    ["maxPrice=-5", { maxPrice: "-5" }, "maxPrice"],
    ["maxPrice=1e", { maxPrice: "1e" }, "maxPrice"],
  ]))("%s: %s is rejected against that parameter", (_id, _case, input, field) => {
    expect(rejected(catalogueQuerySchema, input)).toEqual([field]);
  });
});
