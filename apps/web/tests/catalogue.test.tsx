import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Catalogue } from "../components/Catalogue";
import type { CataloguePage, Category, Product } from "../lib/types";

beforeEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const categories: Category[] = [
  { id: "cat_tools", slug: "tools", name: "Tools" },
  { id: "cat_paper", slug: "paper", name: "Paper" },
];

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_lamp",
    slug: "desk-lamp",
    name: "Desk lamp",
    description: "A lamp for a desk",
    priceCents: 3450,
    discountPercent: 0,
    effectivePriceCents: 3450,
    imageUrl: "/product-placeholder.svg",
    stock: 5,
    categories: [categories[0]],
    ...overrides,
  };
}

function stubFetch(page: Partial<CataloguePage>) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("/categories")) return jsonResponse(200, categories);
    return jsonResponse(200, {
      items: [],
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 0,
      ...page,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function productRequests(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.includes("/products"));
}

describe("Catalogue", () => {
  it("CATL-027: shows a card for every product that came back", async () => {
    stubFetch({
      items: [product(), product({ id: "prd_pen", name: "Fountain pen", priceCents: 4900, effectivePriceCents: 4900 })],
      total: 2,
      totalPages: 1,
    });

    render(<Catalogue onAddToCart={vi.fn()} />);

    expect(await screen.findByText("Desk lamp")).toBeInTheDocument();
    expect(screen.getByText("Fountain pen")).toBeInTheDocument();
    expect(screen.getByText("$34.50")).toBeInTheDocument();
  });

  it("CATL-028: says so when nothing matched", async () => {
    stubFetch({ items: [], total: 0, totalPages: 0 });

    render(<Catalogue onAddToCart={vi.fn()} />);

    expect(await screen.findByText("No products found")).toBeInTheDocument();
  });

  it("CATL-029: asks for the next page", async () => {
    const fetchMock = stubFetch({ items: [product()], total: 20, totalPages: 2 });
    render(<Catalogue onAddToCart={vi.fn()} />);
    await screen.findByText("Desk lamp");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(productRequests(fetchMock).at(-1)).toContain("page=2"));
  });

  it("CATL-030: puts the chosen category in the request", async () => {
    const fetchMock = stubFetch({ items: [product()], total: 1, totalPages: 1 });
    render(<Catalogue onAddToCart={vi.fn()} />);
    await screen.findByText("Desk lamp");

    await userEvent.selectOptions(await screen.findByLabelText("Category"), "paper");

    await waitFor(() => expect(productRequests(fetchMock).at(-1)).toContain("category=paper"));
  });

  it("CATL-031: adds a product to the cart", async () => {
    stubFetch({ items: [product()], total: 1, totalPages: 1 });
    const onAddToCart = vi.fn();
    render(<Catalogue onAddToCart={onAddToCart} />);
    await screen.findByText("Desk lamp");

    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(onAddToCart).toHaveBeenCalledWith("prd_lamp");
  });

  it("CATL-032: says the add is under way while it is, and will not send it twice", async () => {
    stubFetch({ items: [product()], total: 1, totalPages: 1 });
    let release: () => void = () => {};
    const onAddToCart = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    render(<Catalogue onAddToCart={onAddToCart} />);
    await screen.findByText("Desk lamp");

    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    const button = await screen.findByRole("button", { name: "Adding…" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onAddToCart).toHaveBeenCalledTimes(1);

    release();
    expect(await screen.findByRole("button", { name: "Add to cart" })).toBeEnabled();
  });

  it("CATL-033: shows on the product how many of it the cart holds", async () => {
    stubFetch({ items: [product()], total: 1, totalPages: 1 });
    render(<Catalogue onAddToCart={vi.fn()} inCartQuantities={{ prd_lamp: 2 }} />);

    expect(await screen.findByText("In your cart: 2")).toBeInTheDocument();
  });

  it("CATL-034: says nothing about the cart for a product that is not in it", async () => {
    stubFetch({ items: [product()], total: 1, totalPages: 1 });
    render(<Catalogue onAddToCart={vi.fn()} inCartQuantities={{}} />);
    await screen.findByText("Desk lamp");

    expect(screen.queryByText(/In your cart/)).not.toBeInTheDocument();
  });
});
