/**
 * Unit cases from docs/test-plan.md §6.4: cart amounts. Every expected value
 * is worked out by hand in the comment beside it — never by calling the
 * helper under test.
 */
import { cartTotals, lineDiscountCents, lineTotalCents } from "../common/money";

describe("cart amounts", () => {
  it("CRT-07 U-CART-01: a line total is the unit price times the quantity, and an empty line is 0", () => {
    expect(lineTotalCents(1999, 3)).toBe(5997);
    expect(lineTotalCents(1999, 0)).toBe(0);
  });

  it("CRT-07 U-CART-02: a product that is not on sale has no discount", () => {
    expect(lineDiscountCents(1999, 3, 0)).toBe(0);
  });

  it("CRT-07 U-CART-03: the discount is taken from the line total, not from each unit", () => {
    // 3 × 7 ¢ = 21 ¢; 10 % of 21 ¢ = 2.1 ¢ → 2 ¢.
    // Per unit it would be 10 % of 7 ¢ = 0.7 ¢ → 1 ¢, × 3 = 3 ¢ — wrong.
    expect(lineDiscountCents(7, 3, 10)).toBe(2);
  });

  it("CRT-07 U-CART-04: a fraction of a cent rounds to the nearest cent rather than being dropped", () => {
    // 1 × 1999 ¢ at 25 % = 499.75 ¢ → 500 ¢ (truncating would give 499 ¢).
    expect(lineDiscountCents(1999, 1, 25)).toBe(500);
    // 3 × 1999 ¢ = 5997 ¢ at 25 % = 1499.25 ¢ → 1499 ¢.
    expect(lineDiscountCents(1999, 3, 25)).toBe(1499);
  });

  it("CRT-08 U-CART-05: cart totals for an empty cart and for lines with and without a discount", () => {
    expect(cartTotals([])).toEqual({ subtotalCents: 0, discountCents: 0, payableCents: 0 });

    // 1999 × 3 = 5997, 25 % off = 1499.25 → 1499
    //  350 × 2 =  700, no discount       →    0
    //    7 × 3 =   21, 10 % off = 2.1    →    2
    // subtotal 6718, discount 1501, payable 5217.
    expect(
      cartTotals([
        { unitPriceCents: 1999, quantity: 3, discountPercent: 25 },
        { unitPriceCents: 350, quantity: 2, discountPercent: 0 },
        { unitPriceCents: 7, quantity: 3, discountPercent: 10 },
      ]),
    ).toEqual({ subtotalCents: 6718, discountCents: 1501, payableCents: 5217 });
  });
});
