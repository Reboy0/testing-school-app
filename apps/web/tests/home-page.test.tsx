import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import type { Product, UserProfile } from "../lib/types";

const useSessionMock = vi.fn();

vi.mock("../lib/session", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("../lib/cart", () => ({
  useCart: () => ({ cart: null, loading: false, addItem: vi.fn(), refresh: vi.fn() }),
}));

const profile: UserProfile = {
  id: "usr_1",
  email: "sam@example.com",
  name: "Sam Sample",
  phone: null,
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const product: Product = {
  id: "prd_lamp",
  slug: "desk-lamp",
  name: "Desk lamp",
  description: "A lamp for a desk",
  priceCents: 3450,
  discountPercent: 0,
  effectivePriceCents: 3450,
  imageUrl: "/product-image/desk-lamp",
  stock: 5,
  categories: [{ id: "cat_tools", slug: "tools", name: "Tools" }],
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/categories")) return jsonResponse(200, [product.categories[0]]);
      return jsonResponse(200, { items: [product], page: 1, pageSize: 12, total: 1, totalPages: 1 });
    }),
  );
});

describe("HomePage", () => {
  it("HP-009: signed out: shows the intro paragraph and both calls to action", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: false, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(screen.getByText(/account, profile, and saved addresses/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toBeInTheDocument();
  });

  it("HP-010: signed out: shows no greeting", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: false, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
  });

  it("HP-011: signed in: the greeting contains the user's name", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(profile.name);
  });

  it("HP-012: signed in: links to the profile, which now holds the addresses too", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "Your profile" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: "Your addresses" })).not.toBeInTheDocument();
  });

  // Previously this state rendered a lone "School App" heading, which looks
  // like a finished page that simply has nothing on it — exactly how it read
  // during a minute-long cold start on the free tier.
  it("HP-013: loading: says it is loading rather than rendering a bare heading", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: true, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("HP-014: loading: offers neither the signed-in nor the signed-out calls to action", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: true, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Your profile" })).not.toBeInTheDocument();
  });

  it("HP-015: signed out: shows the shop", async () => {
    useSessionMock.mockReturnValue({ profile: null, loading: false, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(await screen.findByText("Desk lamp")).toBeInTheDocument();
    expect(screen.getByText("$34.50")).toBeInTheDocument();
  });

  it("HP-016: signed in: shows the same shop", async () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut: vi.fn() });
    render(<HomePage />);
    expect(await screen.findByText("Desk lamp")).toBeInTheDocument();
  });
});
