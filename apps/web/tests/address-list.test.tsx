import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddressList } from "../components/AddressList";
import type { Address } from "../lib/types";

beforeEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const addresses: Address[] = [
  { id: "addr_1", label: "Home", line1: "12 Elm Street", city: "Springfield", postalCode: "62704", country: "US", isDefault: true },
  { id: "addr_2", label: "Work", line1: "1 Office Plaza", city: "Shelbyville", postalCode: "62705", country: "US", isDefault: false },
];

describe("AddressList", () => {
  it("PROF-041: renders one row per address showing its label and city", () => {
    render(<AddressList addresses={addresses} onDeleted={() => {}} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Home")).toBeInTheDocument();
    expect(within(items[0]).getByText("Springfield")).toBeInTheDocument();
    expect(within(items[1]).getByText("Work")).toBeInTheDocument();
    expect(within(items[1]).getByText("Shelbyville")).toBeInTheDocument();
  });

  it("PROF-042: marks exactly the default one with the text Default", () => {
    render(<AddressList addresses={addresses} onDeleted={() => {}} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Default")).toBeInTheDocument();
    expect(within(items[1]).queryByText("Default")).not.toBeInTheDocument();
    expect(screen.getAllByText("Default")).toHaveLength(1);
  });

  it("PROF-043: DELETEs /users/me/addresses/:id and then calls onDeleted with that id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(204, undefined));
    vi.stubGlobal("fetch", fetchMock);
    const onDeleted = vi.fn();
    render(<AddressList addresses={addresses} onDeleted={onDeleted} />);
    const items = screen.getAllByRole("listitem");
    await userEvent.click(within(items[0]).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("addr_1"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/users/me/addresses/addr_1");
    expect(init.method).toBe("DELETE");
  });
});
