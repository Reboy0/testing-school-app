import { addToCartSchema, catalogueQuerySchema, updateCartLineSchema } from "./catalogue";

describe("catalogueQuerySchema", () => {
  it("VAL-247: defaults to the first page sorted by name", () => {
    expect(catalogueQuerySchema.parse({})).toEqual({ sort: "name_asc", page: 1 });
  });

  it("VAL-248: reads the numbers a query string carries as text", () => {
    const query = catalogueQuerySchema.parse({ page: "3", minPrice: "500", maxPrice: "2000" });
    expect(query.page).toBe(3);
    expect(query.minPrice).toBe(500);
    expect(query.maxPrice).toBe(2000);
  });

  it("VAL-249: treats a blank filter as absent rather than as zero", () => {
    const query = catalogueQuerySchema.parse({ q: "", category: "", minPrice: "", page: "" });
    expect(query.q).toBeUndefined();
    expect(query.category).toBeUndefined();
    expect(query.minPrice).toBeUndefined();
    expect(query.page).toBe(1);
  });

  it("VAL-250: rejects a page below 1", () => {
    const result = catalogueQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("VAL-251: rejects a sort it does not offer", () => {
    const result = catalogueQuerySchema.safeParse({ sort: "price_sideways" });
    expect(result.success).toBe(false);
  });
});

describe("addToCartSchema", () => {
  it("VAL-252: defaults to one item", () => {
    expect(addToCartSchema.parse({ productId: "prd_1" })).toEqual({ productId: "prd_1", quantity: 1 });
  });

  it("VAL-253: rejects a quantity below 1", () => {
    const result = addToCartSchema.safeParse({ productId: "prd_1", quantity: 0 });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].message).toBe("Quantity must be at least 1");
  });

  it("VAL-254: rejects a fractional quantity", () => {
    expect(addToCartSchema.safeParse({ productId: "prd_1", quantity: 1.5 }).success).toBe(false);
  });
});

describe("updateCartLineSchema", () => {
  it("VAL-255: accepts 0, which empties the line", () => {
    expect(updateCartLineSchema.parse({ quantity: 0 })).toEqual({ quantity: 0 });
  });

  it("VAL-256: rejects a negative quantity", () => {
    expect(updateCartLineSchema.safeParse({ quantity: -1 }).success).toBe(false);
  });
});
