import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../components/LoginForm";
import { SessionProvider } from "../lib/session";

const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  push.mockClear();
  search = "";
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("LoginForm", () => {
  it("LOGIN-043: labels both inputs", () => {
    render(
      <SessionProvider>
        <LoginForm />
      </SessionProvider>,
    );
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("LOGIN-044: signs in and navigates home", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));
    render(
      <SessionProvider>
        <LoginForm />
      </SessionProvider>,
    );
    await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("LOGIN-045: shows the API's message when the credentials are rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(401, { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect", fieldErrors: null }),
    ));
    render(
      <SessionProvider>
        <LoginForm />
      </SessionProvider>,
    );
    await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "WrongPassword1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
  });

  it("LOGIN-046: disables the button while the request is in flight", async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((resolve) => { release = resolve; })));
    render(
      <SessionProvider>
        <LoginForm />
      </SessionProvider>,
    );
    await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    release(jsonResponse(200, {}));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
