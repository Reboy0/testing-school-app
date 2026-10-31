/**
 * Component cases C-CART-01 … C-CART-07 from docs/test-plan.md §6.4.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartBadge } from "../components/CartBadge";
import { CartPanel } from "../components/CartPanel";
import { CataloguePanel } from "../components/CataloguePanel";
import { CartProvider, useCart } from "../lib/cart";
import type { Cart } from "../lib/types";
import { cartOf, deferred, jsonResponse, line, page, product, stubApi } from "./plan-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
});

const withCart = (ui: React.ReactNode) => render(<CartProvider>{ui}</CartProvider>);

// iPhone dock 1999 ¢ × 3 at 25 % = 5997 ¢, 1499 ¢ off, 4498 ¢ to pay.
// Pen 350 ¢ × 2 = 700 ¢, nothing off. Totals by hand: 6697 / 1499 / 5198.
const dock = line({ id: "cln_dock", productId: "prd_dock", name: "iPhone dock", unitPriceCents: 1999, discountPercent: 25, quantity: 3, lineTotalCents: 5997, discountCents: 1499, payableCents: 4498 });
const pens = line({ quantity: 2, lineTotalCents: 700, payableCents: 700 });

describe("CartPanel", () => {
  it("CRT-029 C-CART-01: shows each line's quantity and total, and the subtotal, discount and total", async () => {
    stubApi(() => jsonResponse(200, cartOf([dock, pens])));
    withCart(<CartPanel />);

    const [dockRow, penRow] = await screen.findAllByRole("listitem");
    expect(within(dockRow).getByText("iPhone dock")).toBeInTheDocument();
    expect(within(dockRow).getByText("3")).toBeInTheDocument();
    expect(within(dockRow).getByText("$44.98")).toBeInTheDocument();
    expect(within(penRow).getByText("2")).toBeInTheDocument();
    expect(within(penRow).getByText("$7.00")).toBeInTheDocument();

    const totals = document.querySelector("dl")!;
    expect(within(totals).getByText("Subtotal").nextSibling).toHaveTextContent("$66.97");
    expect(within(totals).getByText("Discount").nextSibling).toHaveTextContent("$14.99");
    expect(within(totals).getByText("Total").nextSibling).toHaveTextContent("$51.98");
  });

  it("CRT-014 C-CART-02: +1, −1 and Remove send the matching requests, and −1 on a quantity of 1 removes the line", async () => {
    let current: Cart = cartOf([line({ quantity: 1 })]);
    const api = stubApi(({ method, body }) => {
      if (method === "PATCH") {
        const quantity = (body as { quantity: number }).quantity;
        current = cartOf(quantity === 0 ? [] : [line({ quantity, lineTotalCents: 350 * quantity, payableCents: 350 * quantity })]);
      }
      if (method === "DELETE") current = cartOf([]);
      return jsonResponse(200, current);
    });
    withCart(<CartPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Add one more Pen" }));
    await waitFor(() => expect(api.calls.at(-1)).toEqual({ path: "/cart/items/cln_pen", method: "PATCH", body: { quantity: 2 } }));

    await userEvent.click(await screen.findByRole("button", { name: "Remove one Pen" }));
    await waitFor(() => expect(api.calls.at(-1)).toEqual({ path: "/cart/items/cln_pen", method: "PATCH", body: { quantity: 1 } }));

    await userEvent.click(await screen.findByRole("button", { name: "Remove one Pen" }));
    await waitFor(() => expect(api.calls.at(-1)).toEqual({ path: "/cart/items/cln_pen", method: "PATCH", body: { quantity: 0 } }));
    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();

    current = cartOf([line()]);
    const { unmount } = withCart(<CartPanel />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Remove Pen from the cart" })).at(-1)!);
    await waitFor(() => expect(api.calls.at(-1)).toEqual({ path: "/cart/items/cln_pen", method: "DELETE", body: undefined }));
    unmount();
  });

  it("CRT-037 C-CART-03: an empty cart says so", async () => {
    stubApi(() => jsonResponse(200, cartOf([])));
    withCart(<CartPanel />);

    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
  });
});

describe("CartBadge", () => {
  it("CRT-030 C-CART-04: shows how many items the cart holds, 0 for an empty one, and links to the cart before it has loaded", async () => {
    const pending = deferred<Response>();
    stubApi(() => pending.promise);
    withCart(<CartBadge />);

    expect(screen.getByRole("link", { name: "Cart" })).toHaveAttribute("href", "/cart");
    pending.resolve(jsonResponse(200, cartOf([dock, pens])));
    expect(await screen.findByRole("link", { name: "Cart (5)" })).toBeInTheDocument();
  });

  it("CRT-031 C-CART-04: an empty cart shows 0", async () => {
    stubApi(() => jsonResponse(200, cartOf([])));
    withCart(<CartBadge />);

    expect(await screen.findByRole("link", { name: "Cart (0)" })).toBeInTheDocument();
  });

  it("CRT-032 C-CART-05: after adding, changing and removing a line the badge shows what the server holds", async () => {
    let server: Cart = cartOf([]);
    stubApi(({ method, body }) => {
      if (method === "POST") server = cartOf([line({ quantity: 2, lineTotalCents: 700, payableCents: 700 })]);
      if (method === "PATCH") {
        const quantity = (body as { quantity: number }).quantity;
        server = cartOf([line({ quantity, lineTotalCents: 350 * quantity, payableCents: 350 * quantity })]);
      }
      if (method === "DELETE") server = cartOf([]);
      return jsonResponse(200, server);
    });
    function Controls() {
      const { addItem, setQuantity, removeLine } = useCart();
      return (
        <>
          <button onClick={() => void addItem("prd_pen", 2)}>add</button>
          <button onClick={() => void setQuantity("cln_pen", 5)}>change</button>
          <button onClick={() => void removeLine("cln_pen")}>remove</button>
        </>
      );
    }
    withCart(
      <>
        <CartBadge />
        <Controls />
      </>,
    );
    await screen.findByRole("link", { name: "Cart (0)" });

    await userEvent.click(screen.getByRole("button", { name: "add" }));
    expect(await screen.findByRole("link", { name: "Cart (2)" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "change" }));
    expect(await screen.findByRole("link", { name: "Cart (5)" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "remove" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /^Cart/ })).toHaveAccessibleName("Cart (0)"));
  });
});

describe("Add to cart", () => {
  it("CRT-036 C-CART-06: while adding, the button says so and sends no second request; afterwards the card shows how many the cart holds", async () => {
    const adding = deferred<Response>();
    const api = stubApi(({ path, method }) => {
      if (path === "/cart" && method === "GET") return jsonResponse(200, cartOf([]));
      if (path === "/cart/items") return adding.promise;
      if (path === "/categories") return jsonResponse(200, []);
      return jsonResponse(200, page([product()]));
    });
    withCart(<CataloguePanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Add to cart" }));
    const busy = screen.getByRole("button", { name: "Adding…" });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(api.callsTo("/cart/items")).toHaveLength(1);

    adding.resolve(jsonResponse(200, cartOf([line({ quantity: 1 })])));
    expect(await screen.findByText("In your cart: 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });
});

describe("CartProvider", () => {
  it("CRT-038 C-CART-07: a cart that cannot be read is simply not shown, and nothing breaks", async () => {
    stubApi(() => jsonResponse(500, { code: "INTERNAL_ERROR", message: "Something went wrong", fieldErrors: null }));
    withCart(
      <>
        <CartBadge />
        <CartPanel />
      </>,
    );

    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
