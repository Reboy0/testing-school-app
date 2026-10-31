/**
 * Component cases C-CAT-01, C-CAT-03 … C-CAT-11 from docs/test-plan.md §6.3.
 * (C-CAT-02, the filter labels, is in plan-xcut.test.tsx.)
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Catalogue } from "../components/Catalogue";
import { CatalogueFilters, CatalogueFilterValues } from "../components/CatalogueFilters";
import { LoadingState } from "../components/LoadingState";
import { ProductCard } from "../components/ProductCard";
import type { Category } from "../lib/types";
import { deferred, jsonResponse, page, product, stubApi } from "./plan-helpers";
import { withIds } from "./ids";

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.useRealTimers();
});

const categories: Category[] = [
  { id: "cat_toys", slug: "toys", name: "Toys" },
  { id: "cat_books", slug: "books", name: "Books" },
];

const NO_FILTERS: CatalogueFilterValues = { q: "", category: "", minPrice: "", maxPrice: "", sort: "name_asc" };

describe("ProductCard", () => {
  it("CATL-002 C-CAT-01: a full-price product shows its name, price and image, and no sale", () => {
    render(<ProductCard product={product()} onAdd={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Pen" })).toBeInTheDocument();
    expect(screen.getByText("$3.50")).toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", "/product-image/pen");
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it("CATL-003 C-CAT-01: a product on sale shows the old price struck through, the new price and the percentage", () => {
    render(
      <ProductCard
        product={product({ name: "iPhone dock", priceCents: 1999, discountPercent: 25, effectivePriceCents: 1499 })}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("$14.99")).toBeInTheDocument();
    expect(screen.getByText("$19.99").tagName).toBe("S");
    expect(screen.getByText("25% off")).toBeInTheDocument();
  });

  it("CATL-004 C-CAT-01: a product with no stock says plainly that it is out of stock", () => {
    render(<ProductCard product={product({ stock: 0 })} onAdd={vi.fn()} />);

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
  });
});

describe("CatalogueFilters", () => {
  it("SEARCH-009 C-CAT-03: the category list offers every category plus All categories", () => {
    render(<CatalogueFilters categories={categories} value={NO_FILTERS} onChange={vi.fn()} />);

    const options = within(screen.getByLabelText("Category")).getAllByRole("option");
    expect(options.map((option) => [option.textContent, (option as HTMLOptionElement).value])).toEqual([
      ["All categories", ""],
      ["Toys", "toys"],
      ["Books", "books"],
    ]);
  });

  it("SEARCH-012 C-CAT-04: search, category, prices and sort each report the value chosen", async () => {
    const onChange = vi.fn();
    render(<CatalogueFilters categories={categories} value={NO_FILTERS} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Search"), "d");
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, q: "d" });

    await userEvent.selectOptions(screen.getByLabelText("Category"), "books");
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, category: "books" });

    await userEvent.type(screen.getByLabelText("Lowest price (cents)"), "5");
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, minPrice: "5" });

    await userEvent.type(screen.getByLabelText("Highest price (cents)"), "9");
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, maxPrice: "9" });

    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "price_desc");
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, sort: "price_desc" });
  });
});

describe("Catalogue", () => {
  const products = [product({ id: "prd_a", name: "Apple" }), product({ id: "prd_b", name: "Bottle" })];

  it("CATL-005 C-CAT-05: renders a card for every product in the response", async () => {
    stubApi(({ path }) => (path === "/categories" ? jsonResponse(200, categories) : jsonResponse(200, page(products))));
    render(<Catalogue onAddToCart={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bottle" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add to cart" })).toHaveLength(2);
  });

  it("SORT-013 C-CAT-06: shows the page and the page count, Next asks for page + 1, and Next is unavailable on the last page", async () => {
    const api = stubApi(({ path }) => {
      if (path === "/categories") return jsonResponse(200, categories);
      const requested = Number(new URLSearchParams(path.split("?")[1]).get("page"));
      return jsonResponse(200, page(products, { page: requested, totalPages: 3, total: 30 }));
    });
    render(<Catalogue onAddToCart={vi.fn()} />);

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(api.callsTo("/products").at(-1)!.path).toContain("page=2");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it.each(withIds("SEARCH-018", "SEARCH-021", [
    ["search", async () => userEvent.type(screen.getByLabelText("Search"), "a")],
    ["category", async () => userEvent.selectOptions(screen.getByLabelText("Category"), "toys")],
    ["price", async () => userEvent.type(screen.getByLabelText("Lowest price (cents)"), "1")],
    ["sort", async () => userEvent.selectOptions(screen.getByLabelText("Sort by"), "price_asc")],
  ]))("%s C-CAT-07: changing the %s on page 3 asks for page 1 next", async (_id, _filter, change) => {
    const api = stubApi(({ path }) => {
      if (path === "/categories") return jsonResponse(200, categories);
      const requested = Number(new URLSearchParams(path.split("?")[1]).get("page"));
      return jsonResponse(200, page(products, { page: requested, totalPages: 5, total: 60 }));
    });
    render(<Catalogue onAddToCart={vi.fn()} />);
    await screen.findByText("Page 1 of 5");
    await screen.findByRole("option", { name: "Toys" });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByText("Page 3 of 5");

    await change();

    await waitFor(() => expect(api.callsTo("/products").length).toBeGreaterThan(3));
    expect(new URLSearchParams(api.callsTo("/products").at(-1)!.path.split("?")[1]).get("page")).toBe("1");
  });

  it("CATL-012 C-CAT-08: before the API answers it shows loading and never says nothing was found", () => {
    stubApi(({ path }) => (path === "/categories" ? jsonResponse(200, categories) : new Promise<Response>(() => {})));
    render(<Catalogue onAddToCart={vi.fn()} />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("No products found")).not.toBeInTheDocument();
  });

  it("CATL-013 C-CAT-09: an empty response says No products found, and only once the response has arrived", async () => {
    const pending = deferred<Response>();
    stubApi(({ path }) => (path === "/categories" ? jsonResponse(200, categories) : pending.promise));
    render(<Catalogue onAddToCart={vi.fn()} />);

    expect(screen.queryByText("No products found")).not.toBeInTheDocument();
    pending.resolve(jsonResponse(200, page([])));

    expect(await screen.findByText("No products found")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("CATL-016 C-CAT-10: an API failure shows a clear error rather than an empty list", async () => {
    stubApi(({ path }) =>
      path === "/categories"
        ? jsonResponse(200, categories)
        : jsonResponse(500, { code: "INTERNAL_ERROR", message: "Something went wrong", fieldErrors: null }),
    );
    render(<Catalogue onAddToCart={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.queryByText("No products found")).not.toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  it("CATL-014 C-CAT-11: says Loading… at once, explains after the delay, is a polite live region, and clears its timer on unmount", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(<LoadingState escalateAfterMs={1000} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Loading…");

    act(() => vi.advanceTimersByTime(1000));
    expect(status).toHaveTextContent(/Still waking up the server/);

    const before = clearTimeoutSpy.mock.calls.length;
    unmount();
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});
