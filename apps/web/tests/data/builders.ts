import type { Cart, CartLine, CataloguePage, Product, UserProfile } from "../../lib/types";

/** Canned API payloads, each value chosen by the test that relies on it. */
export const sam: UserProfile = {
  id: "usr_sam",
  email: "sam@example.com",
  name: "Sam Carter",
  phone: null,
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_pen",
    slug: "pen",
    name: "Pen",
    description: "A pen",
    priceCents: 350,
    discountPercent: 0,
    effectivePriceCents: 350,
    imageUrl: "/product-image/pen",
    stock: 10,
    categories: [],
    ...overrides,
  };
}

export function page(items: Product[], overrides: Partial<CataloguePage> = {}): CataloguePage {
  return { items, page: 1, pageSize: 12, total: items.length, totalPages: items.length ? 1 : 0, ...overrides };
}

export function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "cln_pen",
    productId: "prd_pen",
    slug: "pen",
    name: "Pen",
    imageUrl: "/product-image/pen",
    unitPriceCents: 350,
    discountPercent: 0,
    quantity: 1,
    lineTotalCents: 350,
    discountCents: 0,
    payableCents: 350,
    ...overrides,
  };
}

export function cartOf(lines: CartLine[]): Cart {
  const subtotalCents = lines.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const discountCents = lines.reduce((sum, item) => sum + item.discountCents, 0);
  return {
    id: lines.length ? "crt_1" : null,
    itemCount: lines.reduce((sum, item) => sum + item.quantity, 0),
    lines,
    subtotalCents,
    discountCents,
    payableCents: subtotalCents - discountCents,
  };
}
