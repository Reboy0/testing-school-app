import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartPanel } from "../components/CartPanel";
import type { Cart, CartLine } from "../lib/types";

const useCartMock = vi.fn();
const setQuantity = vi.fn().mockResolvedValue(undefined);
const removeLine = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/cart", () => ({
  useCart: () => useCartMock(),
}));

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "cln_pen",
    productId: "prd_pen",
    slug: "pen",
    name: "Pen",
    imageUrl: "/product-placeholder.svg",
    unitPriceCents: 350,
    discountPercent: 0,
    quantity: 2,
    lineTotalCents: 700,
    discountCents: 0,
    payableCents: 700,
    ...overrides,
  };
}

const cart: Cart = {
  id: "crt_1",
  itemCount: 3,
  lines: [
    line(),
    line({
      id: "cln_dock",
      productId: "prd_dock",
      name: "Docking station",
      unitPriceCents: 1999,
      discountPercent: 25,
      quantity: 1,
      lineTotalCents: 1999,
      discountCents: 500,
      payableCents: 1499,
    }),
  ],
  subtotalCents: 2699,
  discountCents: 500,
  payableCents: 2199,
};

beforeEach(() => {
  setQuantity.mockClear();
  removeLine.mockClear();
  useCartMock.mockReturnValue({ cart, loading: false, setQuantity, removeLine });
});

describe("CartPanel", () => {
  it("CRT-064: shows a row per line with its quantity and what that line costs", () => {
    render(<CartPanel />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Pen")).toBeInTheDocument();
    expect(within(rows[0]).getByText("2")).toBeInTheDocument();
    expect(within(rows[0]).getByText("$7.00")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Docking station")).toBeInTheDocument();
    expect(within(rows[1]).getByText("$14.99")).toBeInTheDocument();
  });

  it("CRT-065: shows the subtotal, what is off and what is payable", () => {
    render(<CartPanel />);

    expect(screen.getByText("$26.99")).toBeInTheDocument();
    expect(screen.getByText("−$5.00")).toBeInTheDocument();
    expect(screen.getByText("$21.99")).toBeInTheDocument();
  });

  it("CRT-066: asks for one more of a line", async () => {
    render(<CartPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Add one more Pen" }));

    expect(setQuantity).toHaveBeenCalledWith("cln_pen", 3);
  });

  it("CRT-067: asks for one fewer of a line", async () => {
    render(<CartPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Remove one Pen" }));

    expect(setQuantity).toHaveBeenCalledWith("cln_pen", 1);
  });

  it("CRT-068: removes a line", async () => {
    render(<CartPanel />);

    await userEvent.click(screen.getByRole("button", { name: "Remove Pen from the cart" }));

    expect(removeLine).toHaveBeenCalledWith("cln_pen");
  });

  it("CRT-069: says when there is nothing in the cart", () => {
    useCartMock.mockReturnValue({
      cart: { id: null, itemCount: 0, lines: [], subtotalCents: 0, discountCents: 0, payableCents: 0 },
      loading: false,
      setQuantity,
      removeLine,
    });
    render(<CartPanel />);

    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  });
});
