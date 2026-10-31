import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CartBadge } from "../components/CartBadge";
import type { Cart } from "../lib/types";

const useCartMock = vi.fn();

vi.mock("../lib/cart", () => ({
  useCart: () => useCartMock(),
}));

function cart(itemCount: number): Cart {
  return {
    id: "crt_1",
    itemCount,
    lines: [],
    subtotalCents: 0,
    discountCents: 0,
    payableCents: 0,
  };
}

describe("CartBadge", () => {
  it("CRT-061: shows how many items are in the cart", () => {
    useCartMock.mockReturnValue({ cart: cart(3), loading: false });
    render(<CartBadge />);

    expect(screen.getByRole("link", { name: "Cart (3)" })).toBeInTheDocument();
  });

  it("CRT-062: shows an empty cart as empty", () => {
    useCartMock.mockReturnValue({ cart: cart(0), loading: false });
    render(<CartBadge />);

    expect(screen.getByRole("link", { name: "Cart (0)" })).toBeInTheDocument();
  });

  it("CRT-063: links to the cart before the count is known", () => {
    useCartMock.mockReturnValue({ cart: null, loading: true });
    render(<CartBadge />);

    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
  });
});
