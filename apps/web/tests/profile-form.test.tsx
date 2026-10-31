import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../components/ProfileForm";
import type { UserProfile } from "../lib/types";

beforeEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const profile: UserProfile = {
  id: "usr_1",
  email: "sam@example.com",
  name: "Sam Sample",
  phone: "555-0100",
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("ProfileForm", () => {
  it("PROF-044: labels both inputs", () => {
    render(<ProfileForm profile={profile} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
  });

  it("PROF-045: pre-fills the inputs from the profile, rendering a null phone as an empty string", () => {
    const { unmount } = render(<ProfileForm profile={profile} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Sam Sample");
    expect(screen.getByLabelText("Phone")).toHaveValue("555-0100");
    unmount();

    render(<ProfileForm profile={{ ...profile, phone: null }} />);
    expect(screen.getByLabelText("Phone")).toHaveValue("");
  });

  it("PROF-046: PATCHes /users/me with only the changed fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileForm profile={profile} />);
    await userEvent.clear(screen.getByLabelText("Phone"));
    await userEvent.type(screen.getByLabelText("Phone"), "555-0199");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/users/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ phone: "555-0199" });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({});
  });

  it("PROF-047: renders a fieldErrors.phone response beside the phone input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(422, {
        code: "VALIDATION_FAILED",
        message: "Check the highlighted fields",
        fieldErrors: { phone: ["Enter a valid phone number"] },
      }),
    ));
    render(<ProfileForm profile={profile} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a valid phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-describedby", "phone-error");
  });
});
