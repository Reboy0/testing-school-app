/**
 * Component cases C-AUTH-01 … C-AUTH-16 from docs/test-plan.md §6.1.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";
import { LoginForm } from "../components/LoginForm";
import { RegisterForm } from "../components/RegisterForm";
import { RequireAuth } from "../components/RequireAuth";
import { ResetPasswordForm } from "../components/ResetPasswordForm";
import { SiteHeader } from "../components/SiteHeader";
import { CartProvider } from "../lib/cart";
import { SessionProvider, useSession } from "../lib/session";
import { cartOf, deferred, jsonResponse, sam, stubApi, unauthenticated } from "./plan-helpers";

const push = vi.fn();
let search = "";
let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => pathname,
}));

beforeEach(() => {
  push.mockClear();
  search = "";
  pathname = "/";
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const withSession = (ui: React.ReactNode) => render(<SessionProvider>{ui}</SessionProvider>);

const errorsFor = (input: HTMLElement) => {
  const id = input.getAttribute("aria-describedby");
  return id ? document.getElementById(id) : null;
};

async function fillLogin() {
  await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "Password123!");
}

describe("LoginForm", () => {
  it("XC-02 C-AUTH-01: the email and password inputs are found by their labels", () => {
    stubApi(() => unauthenticated());
    withSession(<LoginForm />);

    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("LOGIN-05 C-AUTH-02: a successful sign-in with no destination goes home", async () => {
    stubApi(({ path }) => (path === "/auth/login" ? jsonResponse(200) : jsonResponse(200, sam)));
    withSession(<LoginForm />);

    await fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("LOGIN-05 C-AUTH-02: a successful sign-in that began on a protected page goes back to that page", async () => {
    search = "returnTo=%2Fprofile";
    stubApi(({ path }) => (path === "/auth/login" ? jsonResponse(200) : jsonResponse(200, sam)));
    withSession(<LoginForm />);

    await fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/profile");
  });

  it("LOGIN-03 C-AUTH-03: a 401 from the API shows its message and leaves the form usable", async () => {
    stubApi(({ path }) =>
      path === "/auth/login"
        ? jsonResponse(401, { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect", fieldErrors: null })
        : unauthenticated(),
    );
    withSession(<LoginForm />);

    await fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("XC-01 C-AUTH-04: fieldErrors from the API appear beside the field they name, which is marked aria-invalid", async () => {
    stubApi(({ path }) =>
      path === "/auth/login"
        ? jsonResponse(400, {
            code: "VALIDATION_FAILED",
            message: "Check the highlighted fields",
            fieldErrors: { email: ["Enter a valid email address"] },
          })
        : unauthenticated(),
    );
    withSession(<LoginForm />);

    await fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const email = screen.getByLabelText("Email address");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(errorsFor(email)).toHaveTextContent("Enter a valid email address");
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });

  it("LOGIN-09 C-AUTH-05: while the request is in flight the button is disabled and a second submit sends nothing", async () => {
    const pending = deferred<Response>();
    const api = stubApi(({ path }) => (path === "/auth/login" ? pending.promise : jsonResponse(200, sam)));
    withSession(<LoginForm />);

    await fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const busy = screen.getByRole("button", { name: "Signing in…" });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    await userEvent.type(screen.getByLabelText("Password"), "{Enter}");

    expect(api.callsTo("/auth/login")).toHaveLength(1);
    pending.resolve(jsonResponse(200));
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});

describe("RegisterForm", () => {
  async function submitRegistration() {
    await userEvent.type(screen.getByLabelText("Email address"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Name"), "Ada");
    await userEvent.type(screen.getByLabelText("Password"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  }

  it("REG-02 C-AUTH-06: every password error the API returns is shown beside the password field", async () => {
    const messages = [
      "Password must be at least 10 characters",
      "Password must contain an uppercase letter",
      "Password must contain a digit",
    ];
    stubApi(({ path }) =>
      path === "/auth/register"
        ? jsonResponse(400, { code: "VALIDATION_FAILED", message: "Check the highlighted fields", fieldErrors: { password: messages } })
        : unauthenticated(),
    );
    withSession(<RegisterForm />);

    await submitRegistration();

    const password = screen.getByLabelText("Password");
    await waitFor(() => expect(password).toHaveAttribute("aria-invalid", "true"));
    const list = errorsFor(password)!;
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(messages);
  });

  it("REG-04 C-AUTH-07: a 409 for an email that is taken is shown to the visitor", async () => {
    stubApi(({ path }) =>
      path === "/auth/register"
        ? jsonResponse(409, { code: "EMAIL_TAKEN", message: "That email is already registered", fieldErrors: null })
        : unauthenticated(),
    );
    withSession(<RegisterForm />);

    await submitRegistration();

    expect(await screen.findByRole("alert")).toHaveTextContent("That email is already registered");
    expect(push).not.toHaveBeenCalled();
  });

  it("REG-06 C-AUTH-08: a successful registration goes home, and the button is disabled while it is in flight", async () => {
    const pending = deferred<Response>();
    stubApi(({ path }) => (path === "/auth/register" ? pending.promise : jsonResponse(200, sam)));
    withSession(<RegisterForm />);

    await submitRegistration();
    expect(screen.getByRole("button", { name: "Creating account…" })).toBeDisabled();

    pending.resolve(jsonResponse(201, { id: "usr_ada" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});

describe("ForgotPasswordForm", () => {
  it("PWD-05 C-AUTH-09: a known and an unknown address get the same confirmation", async () => {
    const confirmations: string[] = [];
    for (const email of ["sam@example.com", "nobody@example.com"]) {
      stubApi(() => jsonResponse(202));
      const { unmount } = render(<ForgotPasswordForm />);
      await userEvent.type(screen.getByLabelText("Email address"), email);
      await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
      confirmations.push((await screen.findByText(/reset link is on its way/)).textContent ?? "");
      unmount();
    }

    expect(confirmations[0]).toBe(confirmations[1]);
  });

  it("PWD-06 C-AUTH-10: an invalid email shows the field error instead of the confirmation", async () => {
    stubApi(() =>
      jsonResponse(400, { code: "VALIDATION_FAILED", message: "Check the highlighted fields", fieldErrors: { email: ["Enter a valid email address"] } }),
    );
    render(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText("Email address"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    const email = screen.getByLabelText("Email address");
    await waitFor(() => expect(errorsFor(email)).toHaveTextContent("Enter a valid email address"));
    expect(screen.queryByText(/reset link is on its way/)).not.toBeInTheDocument();
  });

  it("PWD-06 C-AUTH-10: a network failure shows a message that suggests trying again", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    expect(screen.queryByText(/reset link is on its way/)).not.toBeInTheDocument();
  });
});

describe("ResetPasswordForm", () => {
  it("PWD-01 C-AUTH-11: the token from the query string goes into the request, and success leads to sign-in", async () => {
    search = "token=abc123";
    const api = stubApi(() => jsonResponse(204));
    render(<ResetPasswordForm />);

    await userEvent.type(screen.getByLabelText("New password"), "BrandNewPass1");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(api.callsTo("/auth/reset-password")[0].body).toEqual({ token: "abc123", password: "BrandNewPass1" });
  });

  it("PWD-02 C-AUTH-12: a password the API rejects is reported beside the password field", async () => {
    search = "token=abc123";
    stubApi(() =>
      jsonResponse(400, {
        code: "VALIDATION_FAILED",
        message: "Check the highlighted fields",
        fieldErrors: { password: ["Password must contain a digit"] },
      }),
    );
    render(<ResetPasswordForm />);

    await userEvent.type(screen.getByLabelText("New password"), "NoDigitsHere");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));

    const password = screen.getByLabelText("New password");
    await waitFor(() => expect(password).toHaveAttribute("aria-invalid", "true"));
    expect(errorsFor(password)).toHaveTextContent("Password must contain a digit");
  });

  it("PWD-02 C-AUTH-12: a token the API rejects gives a clear message that the link is no longer valid", async () => {
    search = "token=used";
    stubApi(() => jsonResponse(400, { code: "INVALID_TOKEN", message: "This reset link is no longer valid", fieldErrors: null }));
    render(<ResetPasswordForm />);

    await userEvent.type(screen.getByLabelText("New password"), "BrandNewPass1");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This reset link is no longer valid");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("RequireAuth", () => {
  it("LOGIN-05 C-AUTH-13: shows Loading…, then on 401 sends the visitor to sign in with the current page, never rendering the content", async () => {
    pathname = "/profile";
    const pending = deferred<Response>();
    stubApi(() => pending.promise);
    const child = vi.fn(() => <p>Secret profile</p>);
    render(<RequireAuth>{child}</RequireAuth>);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    pending.resolve(unauthenticated());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login?returnTo=%2Fprofile"));
    expect(child).not.toHaveBeenCalled();
    expect(screen.queryByText("Secret profile")).not.toBeInTheDocument();
  });
});

describe("SiteHeader", () => {
  const renderHeader = () =>
    render(
      <SessionProvider>
        <CartProvider>
          <SiteHeader />
        </CartProvider>
      </SessionProvider>,
    );

  it("LOGIN-07 C-AUTH-14: a guest sees Login and Register, and neither a name nor Sign out", async () => {
    stubApi(({ path }) => (path === "/cart" ? jsonResponse(200, cartOf([])) : unauthenticated()));
    renderHeader();

    expect(await screen.findByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByText(sam.name)).not.toBeInTheDocument();
  });

  it("LOGIN-07 C-AUTH-14: a signed-in user sees their name linking to /profile and Sign out, and no Login or Register", async () => {
    stubApi(({ path }) => (path === "/cart" ? jsonResponse(200, cartOf([])) : jsonResponse(200, sam)));
    renderHeader();

    expect(await screen.findByRole("link", { name: sam.name })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Register" })).not.toBeInTheDocument();
  });

  it("LOGIN-07 C-AUTH-14: while the session loads, placeholders hidden from assistive technology stand in for both", () => {
    stubApi(({ path }) => (path === "/cart" ? jsonResponse(200, cartOf([])) : new Promise<Response>(() => {})));
    renderHeader();

    expect(screen.getByTestId("nav-skeleton")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("LOGIN-06 C-AUTH-15: Sign out posts /auth/logout and then reads the session again", async () => {
    let signedIn = true;
    const api = stubApi(({ path }) => {
      if (path === "/cart") return jsonResponse(200, cartOf([]));
      if (path === "/auth/logout") {
        signedIn = false;
        return jsonResponse(204);
      }
      return signedIn ? jsonResponse(200, sam) : unauthenticated();
    });
    renderHeader();

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("link", { name: "Login" })).toBeInTheDocument();
    const sequence = api.calls.filter((call) => call.path !== "/cart").map((call) => `${call.method} ${call.path}`);
    expect(sequence).toEqual(["GET /users/me", "POST /auth/logout", "GET /users/me"]);
  });
});

describe("SessionProvider", () => {
  function Probe() {
    const { profile, loading } = useSession();
    return <p>{loading ? "loading" : profile ? profile.name : "signed out"}</p>;
  }

  it.each([
    [401, unauthenticated],
    [500, () => jsonResponse(500, { code: "INTERNAL_ERROR", message: "Something went wrong", fieldErrors: null })],
  ])("LOGIN-08 C-AUTH-16: a %i from /users/me leaves profile null without throwing, after exactly one request", async (_status, respond) => {
    const api = stubApi(() => respond());
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].path).toBe("/users/me");
  });
});
