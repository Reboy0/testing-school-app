/**
 * Unit cases from docs/test-plan.md for the schemas the API and the browser
 * share. Every test title starts with the plan id it implements, so a failure
 * reads straight back to the case in the plan and in OpenCards.
 */
import {
  addressInputSchema,
  addToCartSchema,
  catalogueQuerySchema,
  registerSchema,
  updateCartLineSchema,
  updateProfileSchema,
} from "./index";

const fieldErrorsOf = (result: { success: boolean; error?: { flatten(): { fieldErrors: Record<string, string[] | undefined> } } }) =>
  result.success ? {} : result.error!.flatten().fieldErrors;

describe("registerSchema", () => {
  const valid = { email: "ada@example.com", name: "Ada", password: "Abcdefghi1" };

  it("REG-01 U-AUTH-01: accepts a valid email, name and the 10-character password Abcdefghi1", () => {
    expect(registerSchema.safeParse(valid)).toEqual({ success: true, data: valid });
  });

  it("REG-02 U-AUTH-02: rejects a 9-character password that meets every other rule, against password", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Abcdefgh1" });

    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result).password).toEqual(["Password must be at least 10 characters"]);
  });

  it.each([
    ["no uppercase letter", "abcdefghi1", "Password must contain an uppercase letter"],
    ["no lowercase letter", "ABCDEFGHI1", "Password must contain a lowercase letter"],
    ["no digit", "Abcdefghij", "Password must contain a digit"],
  ])("REG-02 U-AUTH-03: a password with %s gets its own error against password", (_rule, password, message) => {
    const result = registerSchema.safeParse({ ...valid, password });

    expect(fieldErrorsOf(result).password).toEqual([message]);
  });

  it.each([
    ["email", { name: "Ada", password: "Abcdefghi1" }],
    ["name", { email: "ada@example.com", password: "Abcdefghi1" }],
    ["password", { email: "ada@example.com", name: "Ada" }],
    ["email", { ...valid, email: "" }],
    ["name", { ...valid, name: "" }],
    ["password", { ...valid, password: "" }],
  ])("REG-03 U-AUTH-04: a missing or empty %s is reported against that field", (field, input) => {
    const errors = fieldErrorsOf(registerSchema.safeParse(input));

    expect(Object.keys(errors)).toEqual([field]);
  });

  it.each(["a", "a@", "@b.c", "ada @example.com"])("REG-03 U-AUTH-05: rejects the malformed email %j against email", (email) => {
    const errors = fieldErrorsOf(registerSchema.safeParse({ ...valid, email }));

    expect(Object.keys(errors)).toEqual(["email"]);
  });
});

describe("updateProfileSchema", () => {
  it("PROF-03 U-USER-01: accepts a partial body and an empty body, and drops unknown fields", () => {
    expect(updateProfileSchema.parse({ phone: "+380501234567" })).toEqual({ phone: "+380501234567" });
    expect(updateProfileSchema.parse({})).toEqual({});
    expect(updateProfileSchema.parse({ name: "Ada", role: "ADMIN", email: "x@y.z", id: "usr_1" })).toEqual({
      name: "Ada",
    });
  });
});

describe("addressInputSchema", () => {
  const address = { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" };

  it("PROF-05 U-USER-02: a missing, empty or malformed field is reported against that field", () => {
    expect(addressInputSchema.safeParse(address).success).toBe(true);

    for (const field of ["label", "line1", "city", "postalCode"] as const) {
      expect(Object.keys(fieldErrorsOf(addressInputSchema.safeParse({ ...address, [field]: "" })))).toEqual([field]);
      const { [field]: _omitted, ...missing } = address;
      expect(Object.keys(fieldErrorsOf(addressInputSchema.safeParse(missing)))).toEqual([field]);
    }

    expect(fieldErrorsOf(addressInputSchema.safeParse({ ...address, country: "UKR" })).country).toEqual([
      "Use a two-letter country code",
    ]);
  });
});

describe("catalogueQuerySchema", () => {
  it("SEARCH-07 U-CAT-08: coerces query-string numbers, treats blanks as absent, rejects invalid page and sort", () => {
    expect(catalogueQuerySchema.parse({ page: "2", minPrice: "500", maxPrice: "1500" })).toEqual({
      page: 2,
      minPrice: 500,
      maxPrice: 1500,
      sort: "name_asc",
    });
    expect(catalogueQuerySchema.parse({ q: " ", category: "", minPrice: "", maxPrice: "", page: "", sort: "" })).toEqual({
      page: 1,
      sort: "name_asc",
    });

    expect(fieldErrorsOf(catalogueQuerySchema.safeParse({ page: "0" })).page).toEqual(["Page must be at least 1"]);
    expect(Object.keys(fieldErrorsOf(catalogueQuerySchema.safeParse({ sort: "price_sideways" })))).toEqual(["sort"]);
    expect(Object.keys(fieldErrorsOf(catalogueQuerySchema.safeParse({ minPrice: "-1" })))).toEqual(["minPrice"]);
    expect(Object.keys(fieldErrorsOf(catalogueQuerySchema.safeParse({ maxPrice: "cheap" })))).toEqual(["maxPrice"]);

    // min > max is a well-formed query that simply matches nothing; the
    // schema must not mangle it into something else.
    expect(catalogueQuerySchema.parse({ minPrice: "2000", maxPrice: "1000" })).toMatchObject({
      minPrice: 2000,
      maxPrice: 1000,
    });
  });
});

describe("addToCartSchema", () => {
  it("CRT-03 U-CART-06: defaults a missing quantity to 1 and rejects 0, -1, 1.5 and a word", () => {
    expect(addToCartSchema.parse({ productId: "prd_1" })).toEqual({ productId: "prd_1", quantity: 1 });

    for (const quantity of [0, -1, 1.5, "lots"]) {
      expect(Object.keys(fieldErrorsOf(addToCartSchema.safeParse({ productId: "prd_1", quantity })))).toEqual([
        "quantity",
      ]);
    }
  });
});

describe("updateCartLineSchema", () => {
  it("CRT-05 U-CART-07: accepts 0 and rejects -1 and 1.5", () => {
    expect(updateCartLineSchema.parse({ quantity: 0 })).toEqual({ quantity: 0 });
    expect(updateCartLineSchema.safeParse({ quantity: -1 }).success).toBe(false);
    expect(updateCartLineSchema.safeParse({ quantity: 1.5 }).success).toBe(false);
  });
});
