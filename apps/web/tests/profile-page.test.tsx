import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../app/profile/page";
import type { Address, UserProfile } from "../lib/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/profile",
}));

const profile: UserProfile = {
  id: "usr_1",
  email: "student@example.com",
  name: "Sam Sample",
  phone: "555-0100",
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const addresses: Address[] = [
  {
    id: "addr_1",
    label: "Home",
    line1: "12 Elm Street",
    city: "Springfield",
    postalCode: "62704",
    country: "US",
    isDefault: true,
  },
];

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

beforeEach(() => {
  push.mockClear();
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        String(url).includes("/users/me/addresses")
          ? jsonResponse(200, addresses)
          : jsonResponse(200, profile),
      ),
    ),
  );
});

describe("ProfilePage", () => {
  it("PROF-048: shows the signed-in user's profile form", async () => {
    render(<ProfilePage />);
    expect(await screen.findByDisplayValue("Sam Sample")).toBeInTheDocument();
    expect(screen.getByText("student@example.com")).toBeInTheDocument();
  });

  it("PROF-049: shows the saved addresses on the same page", async () => {
    render(<ProfilePage />);
    expect(await screen.findByText("Springfield")).toBeInTheDocument();
  });

  it("PROF-050: offers the new-address form on the same page", async () => {
    render(<ProfilePage />);
    expect(await screen.findByRole("button", { name: "Save address" })).toBeInTheDocument();
  });

  it("PROF-051: separates the addresses with their own section heading", async () => {
    render(<ProfilePage />);
    expect(await screen.findByRole("heading", { name: "Addresses" })).toBeInTheDocument();
  });
});
