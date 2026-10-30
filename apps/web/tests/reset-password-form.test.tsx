import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "../components/ResetPasswordForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("token=abc123"),
}));

beforeEach(() => { push.mockClear(); vi.unstubAllGlobals(); });

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("ResetPasswordForm", () => {
  it("PWD-030: labels the new-password input", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("PWD-031: sends the token from the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(204, {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "BrandNewPass1");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "abc123", password: "BrandNewPass1" });
  });

  it("PWD-032: navigates to sign-in after a successful reset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(204, {})));
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "BrandNewPass1");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("PWD-033: shows the API's message when the link is no longer valid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(400, { code: "INVALID_TOKEN", message: "This reset link is no longer valid", fieldErrors: null }),
    ));
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "BrandNewPass1");
    await userEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This reset link is no longer valid");
  });
});
