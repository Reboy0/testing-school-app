import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "../components/ProductCard";
import type { Product } from "../lib/types";

const product: Product = {
  id: "prd_lamp",
  slug: "desk-lamp",
  name: "Desk lamp",
  description: "A lamp for a desk",
  priceCents: 3450,
  discountPercent: 10,
  effectivePriceCents: 3105,
  imageUrl: "/product-placeholder.svg",
  stock: 5,
  categories: [{ id: "cat_tools", slug: "tools", name: "Tools" }],
};

describe("ProductCard", () => {
  it("CATL-025: renders a card for the product", () => {
    const { container } = render(<ProductCard product={product} onAdd={vi.fn()} />);

    expect(container.querySelector("li")).not.toBeNull();
    expect(container.textContent).toBeTruthy();
  });

  it("CATL-026: renders the picture and a button", () => {
    const { container } = render(<ProductCard product={product} onAdd={vi.fn()} />);

    expect(container.querySelector("img")).not.toBeNull();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
