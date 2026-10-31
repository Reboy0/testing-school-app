import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "../components/SiteHeader";
import type { UserProfile } from "../lib/types";

const push = vi.fn();
const signOut = vi.fn().mockResolvedValue(undefined);
const useSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("../lib/session", () => ({
  useSession: () => useSessionMock(),
}));

vi.mock("../lib/cart", () => ({
  useCart: () => ({ cart: { id: null, itemCount: 0, lines: [], subtotalCents: 0, discountCents: 0, payableCents: 0 }, loading: false }),
}));

const profile: UserProfile = {
  id: "usr_1",
  email: "student@example.com",
  name: "Sam Sample",
  phone: null,
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  push.mockClear();
  signOut.mockClear();
});

describe("SiteHeader", () => {
  it("LOGIN-057: signed out: shows Login and Register links", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
  });

  it("LOGIN-058: signed out: has no Sign out button and no Profile link", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("LOGIN-059: signed in: shows the user's name", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByText("Sam Sample")).toBeInTheDocument();
  });

  it("LOGIN-060: signed in: the user's name links to the profile", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Sam Sample" })).toHaveAttribute("href", "/profile");
  });

  it("LOGIN-061: signed in: offers no separate Profile or Addresses link", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Addresses" })).not.toBeInTheDocument();
  });

  it("LOGIN-062: signed in: still offers the catalogue, the cart and the reports", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Catalogue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart (0)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/reports/uap");
  });

  it("LOGIN-063: signed in: shows a Sign out button", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("LOGIN-064: signed in: has no Login or Register link", () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Register" })).not.toBeInTheDocument();
  });

  // On a sleeping free-tier API the session request can take up to a minute.
  // Hiding the nav outright left the header looking finished but empty, and
  // then jumping when the real links arrived.
  it("LOGIN-065: loading: shows placeholders in place of the nav", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: true, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByTestId("nav-skeleton")).toBeInTheDocument();
  });

  it("LOGIN-066: loading: commits to neither the signed-in nor the signed-out nav", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: true, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Register" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("LOGIN-067: loading: hides the placeholders from assistive technology", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: true, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByTestId("nav-skeleton")).toHaveAttribute("aria-hidden", "true");
  });

  it("LOGIN-068: offers the catalogue and the cart whether or not anyone is signed in", () => {
    useSessionMock.mockReturnValue({ profile: null, loading: false, refresh: vi.fn(), signOut });
    const { unmount } = render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Catalogue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart (0)" })).toBeInTheDocument();
    unmount();

    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Catalogue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart (0)" })).toBeInTheDocument();
  });

  it("LOGIN-069: clicking Sign out calls the session's signOut", async () => {
    useSessionMock.mockReturnValue({ profile, loading: false, refresh: vi.fn(), signOut });
    render(<SiteHeader />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
