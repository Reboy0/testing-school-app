import { cartTotals, lineDiscountCents, lineTotalCents } from "./money";

describe("cart totals", () => {
  const lines = [
    { unitPriceCents: 1999, quantity: 3, discountPercent: 25 },
    { unitPriceCents: 350, quantity: 2, discountPercent: 0 },
  ];

  it("CRT-039: adds up every line", () => {
    const expected = lines.reduce(
      (total, line) => total + lineTotalCents(line.unitPriceCents, line.quantity),
      0,
    );

    expect(cartTotals(lines).subtotalCents).toBe(expected);
  });

  it("CRT-040: adds up every discount", () => {
    const expected = lines.reduce(
      (total, line) =>
        total + lineDiscountCents(line.unitPriceCents, line.quantity, line.discountPercent),
      0,
    );

    expect(cartTotals(lines).discountCents).toBe(expected);
  });

  it("CRT-041: charges the subtotal less the discounts", () => {
    const totals = cartTotals(lines);

    expect(totals.payableCents).toBe(totals.subtotalCents - totals.discountCents);
  });
});
