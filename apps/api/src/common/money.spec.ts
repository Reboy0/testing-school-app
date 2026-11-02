import { cartTotals, effectivePriceCents, lineDiscountCents, lineTotalCents } from "./money";

describe("lineTotalCents", () => {
  it("CRT-042: multiplies the unit price by the quantity", () => {
    expect(lineTotalCents(1999, 2)).toBe(3998);
  });

  it("CRT-043: is zero for an empty line", () => {
    expect(lineTotalCents(1999, 0)).toBe(0);
  });
});

describe("lineDiscountCents", () => {
  it("CRT-044: is nothing when the product is not on sale", () => {
    expect(lineDiscountCents(1999, 2, 0)).toBe(0);
  });

  it("CRT-045: takes the percentage off the line total", () => {
    // 2 x 1000 cents = 2000 cents, 10% of which is 200 cents.
    expect(lineDiscountCents(1000, 2, 10)).toBe(200);
  });

  it("CRT-046: rounds a fraction of a cent to the nearest cent", () => {
    // 1 x 1999 cents at 25% is 499.75 cents, which is 500 cents to the
    // nearest whole one.
    expect(lineDiscountCents(1999, 1, 25)).toBe(500);
  });
});

describe("effectivePriceCents", () => {
  it("CRT-047: is the list price when nothing is off", () => {
    expect(effectivePriceCents(1999, 0)).toBe(1999);
  });

  it("CRT-048: is the list price less the discount", () => {
    // 1999 cents less 25% (500 cents, rounded) is 1499 cents.
    expect(effectivePriceCents(1999, 25)).toBe(1499);
  });
});

describe("cartTotals", () => {
  it("CRT-049: is all zeroes for an empty cart", () => {
    expect(cartTotals([])).toEqual({ subtotalCents: 0, discountCents: 0, payableCents: 0 });
  });

  it("CRT-050: adds the lines up and subtracts what is off", () => {
    // 2 x 1000 = 2000, less 10% = 200. Plus 1 x 350 at no discount.
    // Subtotal 2350, discount 200, payable 2150 — worked out by hand.
    expect(
      cartTotals([
        { unitPriceCents: 1000, quantity: 2, discountPercent: 10 },
        { unitPriceCents: 350, quantity: 1, discountPercent: 0 },
      ]),
    ).toEqual({ subtotalCents: 2350, discountCents: 200, payableCents: 2150 });
  });
});
