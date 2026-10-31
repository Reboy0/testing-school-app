import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddressForm } from "../components/AddressForm";
import type { Address } from "../lib/types";

beforeEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const created: Address = {
  id: "addr_1",
  label: "Home",
  line1: "12 Elm Street",
  city: "Springfield",
  postalCode: "62704",
  country: "US",
  isDefault: true,
};

async function fillForm() {
  await userEvent.type(screen.getByPlaceholderText("Home"), "Home");
  await userEvent.type(screen.getByPlaceholderText("12 Elm Street"), "12 Elm Street");
  await userEvent.type(screen.getByPlaceholderText("Springfield"), "Springfield");
  await userEvent.type(screen.getByPlaceholderText("62704"), "62704");
  await userEvent.type(screen.getByPlaceholderText("US"), "US");
}

describe("AddressForm", () => {
  it("PROF-036: renders all five inputs", () => {
    render(<AddressForm onCreated={() => {}} />);
    expect(screen.getByPlaceholderText("Home")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("12 Elm Street")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Springfield")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("62704")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("US")).toBeInTheDocument();
  });

  it("PROF-037: POSTs /users/me/addresses with the filled-in values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, created));
    vi.stubGlobal("fetch", fetchMock);
    render(<AddressForm onCreated={() => {}} />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/users/me/addresses");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      label: "Home",
      line1: "12 Elm Street",
      city: "Springfield",
      postalCode: "62704",
      country: "US",
    });
  });

  it("PROF-038: calls onCreated with the created address and clears the form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, created)));
    const onCreated = vi.fn();
    render(<AddressForm onCreated={onCreated} />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(screen.getByPlaceholderText("Home")).toHaveValue("");
    expect(screen.getByPlaceholderText("12 Elm Street")).toHaveValue("");
    expect(screen.getByPlaceholderText("Springfield")).toHaveValue("");
    expect(screen.getByPlaceholderText("62704")).toHaveValue("");
    expect(screen.getByPlaceholderText("US")).toHaveValue("");
  });

  it("PROF-039: renders a fieldErrors.country response beside the country input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(422, {
        code: "VALIDATION_FAILED",
        message: "Check the highlighted fields",
        fieldErrors: { country: ["Enter a two-letter country code"] },
      }),
    ));
    render(<AddressForm onCreated={() => {}} />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByText("Enter a two-letter country code")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("US")).toHaveAttribute("aria-describedby", "country-error");
  });

  it("PROF-040: disables the button while the request is in flight", async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((resolve) => { release = resolve; })));
    render(<AddressForm onCreated={() => {}} />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    release(jsonResponse(201, created));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save address" })).not.toBeDisabled());
  });
});
