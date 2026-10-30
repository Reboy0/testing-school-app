import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

beforeEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("ForgotPasswordForm", () => {
  it("PWD-025: labels the email input", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("PWD-026: posts the email and shows the confirmation regardless of whether the address exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/forgot-password");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "sam@example.com" });
    expect(
      await screen.findByText("If that address is registered, a reset link is on its way."),
    ).toBeInTheDocument();
  });

  it("PWD-027: disables the button while the request is in flight", async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((resolve) => { release = resolve; })));
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    release(jsonResponse(202, {}));
    await waitFor(() =>
      expect(screen.getByText("If that address is registered, a reset link is on its way.")).toBeInTheDocument(),
    );
  });

  it("PWD-028: shows the field error instead of the confirmation when the address is not a valid email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          code: "VALIDATION_FAILED",
          message: "Check the highlighted fields",
          fieldErrors: { email: ["Enter a valid email address"] },
        }),
      ),
    );
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email address"), "sam@");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.queryByText("If that address is registered, a reset link is on its way.")).not.toBeInTheDocument();
  });

  it("PWD-029: shows a retry message instead of the confirmation when the request never reaches the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("Email address"), "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(screen.queryByText("If that address is registered, a reset link is on its way.")).not.toBeInTheDocument();
  });
});
