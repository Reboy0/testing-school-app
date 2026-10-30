/**
 * Component cases C-HOME-01 … C-HOME-04 (§6.5) and C-THEME-01, C-THEME-02
 * (§6.6) from docs/test-plan.md.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { SiteHeader } from "../components/SiteHeader";
import { ThemeToggle } from "../components/ThemeToggle";
import { CartProvider } from "../lib/cart";
import { SessionProvider } from "../lib/session";
import { cartOf, jsonResponse, page, product, sam, stubApi, unauthenticated } from "./plan-helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

beforeEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

function stubShop(session: () => Response | Promise<Response>) {
  return stubApi(({ path }) => {
    if (path === "/users/me") return session();
    if (path === "/cart") return jsonResponse(200, cartOf([]));
    if (path === "/categories") return jsonResponse(200, []);
    return jsonResponse(200, page([product({ name: "Desk lamp" })]));
  });
}

const renderHome = () =>
  render(
    <SessionProvider>
      <CartProvider>
        <HomePage />
      </CartProvider>
    </SessionProvider>,
  );

describe("HomePage", () => {
  it("HP-01 C-HOME-01: a guest is told what the app is and offered sign-in and registration, with no greeting", async () => {
    stubShop(unauthenticated);
    renderHome();

    expect(await screen.findByText(/keeps your account, profile, and saved addresses/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  it("HP-02 C-HOME-02: a signed-in user is greeted by name with a link to their profile, and no guest prompts", async () => {
    stubShop(() => jsonResponse(200, sam));
    renderHome();

    expect(await screen.findByRole("heading", { name: `Welcome back, ${sam.name}` })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your profile" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument();
  });

  it("HP-03 C-HOME-03: while the session loads it shows loading, and neither the guest prompts nor a greeting", () => {
    stubShop(() => new Promise<Response>(() => {}));
    renderHome();

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  it.each([
    ["a guest", unauthenticated],
    ["a signed-in user", () => jsonResponse(200, sam)],
  ])("HP-04 C-HOME-04: the catalogue is shown to %s", async (_who, session) => {
    stubShop(session);
    renderHome();

    expect(await screen.findByRole("heading", { name: "Browse the shop" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Desk lamp" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});

describe("ThemeToggle", () => {
  it("TH-01 C-THEME-01: has an accessible name and switches light ↔ dark", async () => {
    render(<ThemeToggle />);

    const toggle = await screen.findByRole("button", { name: "Switch to the dark theme" });
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(toggle).toHaveAccessibleName("Switch to the light theme");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(toggle).toHaveAccessibleName("Switch to the dark theme");
  });

  it.each([
    ["a guest", unauthenticated],
    ["a signed-in user", () => jsonResponse(200, sam)],
  ])("TH-01 C-THEME-01: the header offers the toggle to %s", async (_who, session) => {
    stubShop(session);
    render(
      <SessionProvider>
        <CartProvider>
          <SiteHeader />
        </CartProvider>
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.queryByTestId("nav-skeleton")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Switch to the (dark|light) theme/ })).toBeInTheDocument();
  });

  it("TH-02 C-THEME-02: the choice is written to storage, and a stored choice is read when the toggle mounts", async () => {
    const first = render(<ThemeToggle />);
    await userEvent.click(await screen.findByRole("button", { name: "Switch to the dark theme" }));
    expect(window.localStorage.getItem("theme")).toBe("dark");
    first.unmount();

    render(<ThemeToggle />);
    expect(await screen.findByRole("button", { name: "Switch to the light theme" })).toHaveAttribute("aria-pressed", "true");
  });
});
