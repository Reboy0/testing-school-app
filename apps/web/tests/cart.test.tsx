import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart } from "../lib/cart";
import type { Cart } from "../lib/types";

beforeEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function cart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "crt_1",
    itemCount: 1,
    lines: [
      {
        id: "cln_pen",
        productId: "prd_pen",
        slug: "pen",
        name: "Pen",
        imageUrl: "/product-placeholder.svg",
        unitPriceCents: 350,
        discountPercent: 0,
        quantity: 1,
        lineTotalCents: 350,
        discountCents: 0,
        payableCents: 350,
      },
    ],
    subtotalCents: 350,
    discountCents: 0,
    payableCents: 350,
    ...overrides,
  };
}

const emptyCart: Cart = {
  id: null,
  itemCount: 0,
  lines: [],
  subtotalCents: 0,
  discountCents: 0,
  payableCents: 0,
};

function Probe() {
  const state = useCart();
  return (
    <div>
      <p>Loading: {String(state.loading)}</p>
      <p>Items: {state.cart ? state.cart.itemCount : "none"}</p>
      <p>Lines: {state.cart ? state.cart.lines.length : "none"}</p>
      <button onClick={() => void state.addItem("prd_pen")}>Add</button>
      <button onClick={() => void state.setQuantity("cln_pen", 2)}>Set two</button>
      <button onClick={() => void state.removeLine("cln_pen")}>Remove</button>
    </div>
  );
}

function renderProbe() {
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
}

describe("CartProvider / useCart", () => {
  it("CRT-070: is loading until the cart comes back", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));
    renderProbe();
    expect(screen.getByText("Loading: true")).toBeInTheDocument();
  });

  it("CRT-071: reads the cart once on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, cart()));
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();

    expect(await screen.findByText("Items: 1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/cart");
  });

  it("CRT-072: shows no cart rather than an error when the cart cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { code: "INTERNAL_ERROR" })));
    renderProbe();

    expect(await screen.findByText("Items: none")).toBeInTheDocument();
    expect(screen.getByText("Loading: false")).toBeInTheDocument();
  });

  it("CRT-073: adds an item and keeps what the server answered", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, emptyCart))
      .mockResolvedValueOnce(jsonResponse(200, cart({ itemCount: 3 })));
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    await screen.findByText("Items: 0");

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Items: 3")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/cart/items");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ productId: "prd_pen", quantity: 1 });
  });

  it("CRT-074: changes a quantity through the line", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, cart()))
      .mockResolvedValueOnce(jsonResponse(200, cart({ itemCount: 2 })));
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    await screen.findByText("Items: 1");

    await userEvent.click(screen.getByRole("button", { name: "Set two" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/cart/items/cln_pen");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ quantity: 2 });
  });

  it("CRT-075: removes a line", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, cart()))
      .mockResolvedValueOnce(jsonResponse(200, emptyCart));
    vi.stubGlobal("fetch", fetchMock);
    renderProbe();
    await screen.findByText("Lines: 1");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Lines: 0")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/cart/items/cln_pen");
    expect(init.method).toBe("DELETE");
  });
});
