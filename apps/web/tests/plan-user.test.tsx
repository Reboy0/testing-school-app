/**
 * Component cases C-USER-02 … C-USER-10 from docs/test-plan.md §6.2.
 * (C-USER-01, -04, -05 and -07 — labels and field errors — are in
 * plan-xcut.test.tsx with the other cross-cutting form checks.)
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../app/profile/page";
import { AddressForm } from "../components/AddressForm";
import { AddressList } from "../components/AddressList";
import { ProfileForm } from "../components/ProfileForm";
import type { Address } from "../lib/types";
import { jsonResponse, sam, stubApi } from "./plan-helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/profile",
}));

beforeEach(() => {
  vi.unstubAllGlobals();
});

const home: Address = { id: "adr_home", label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA", isDefault: true };
const work: Address = { id: "adr_work", label: "Work", line1: "2 Khreshchatyk", city: "Lviv", postalCode: "79000", country: "UA", isDefault: false };

/** The address form's controls by name: they are reached this way here so these cases do not fail on USER-05 too. */
const control = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;

describe("ProfileForm", () => {
  it("PROF-008 C-USER-02: starts filled with the profile, showing a null phone as an empty field", () => {
    render(<ProfileForm profile={{ ...sam, phone: null }} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Sam Carter");
    expect(screen.getByLabelText("Phone")).toHaveValue("");
  });

  it("PROF-009 C-USER-03: saving after changing one field sends only that field", async () => {
    const api = stubApi(() => jsonResponse(200, { ...sam, phone: "+380501234567" }));
    render(<ProfileForm profile={sam} />);

    await userEvent.type(screen.getByLabelText("Phone"), "+380501234567");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(api.calls[0]).toEqual({ path: "/users/me", method: "PATCH", body: { phone: "+380501234567" } });
  });
});

describe("AddressForm", () => {
  it("PROF-017 C-USER-06: submitting posts the values typed, calls onCreated with the result and clears the form", async () => {
    const created: Address = { ...work, id: "adr_new" };
    const api = stubApi(() => jsonResponse(201, created));
    const onCreated = vi.fn();
    render(<AddressForm onCreated={onCreated} />);

    for (const [name, value] of Object.entries({ label: "Work", line1: "2 Khreshchatyk", city: "Lviv", postalCode: "79000", country: "UA" })) {
      await userEvent.type(control(name), value);
    }
    await userEvent.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(api.calls[0]).toEqual({
      path: "/users/me/addresses",
      method: "POST",
      body: { label: "Work", line1: "2 Khreshchatyk", city: "Lviv", postalCode: "79000", country: "UA" },
    });
    for (const name of ["label", "line1", "city", "postalCode", "country"]) {
      expect(control(name)).toHaveValue("");
    }
  });
});

describe("AddressList", () => {
  it("PROF-021 C-USER-08: renders one row per address, with Default on exactly one", () => {
    render(<AddressList addresses={[home, work]} onDeleted={vi.fn()} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Home")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Work")).toBeInTheDocument();
    expect(screen.getAllByText("Default")).toHaveLength(1);
    expect(within(rows[0]).getByText("Default")).toBeInTheDocument();
  });

  it("PROF-018 C-USER-09: Delete sends DELETE for that address's id and then reports onDeleted(id)", async () => {
    const api = stubApi(() => jsonResponse(204));
    const onDeleted = vi.fn();
    render(<AddressList addresses={[home, work]} onDeleted={onDeleted} />);

    await userEvent.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("adr_work"));
    expect(api.calls).toEqual([{ path: "/users/me/addresses/adr_work", method: "DELETE", body: undefined }]);
  });
});

describe("ProfilePage", () => {
  it("PROF-025 C-USER-10: shows the email and the profile form, and below them an Addresses section with its heading, the list and the add form", async () => {
    stubApi(({ path }) => (path === "/users/me" ? jsonResponse(200, sam) : jsonResponse(200, [home])));
    render(<ProfilePage />);

    const email = await screen.findByText("sam@example.com");
    const heading = screen.getByRole("heading", { level: 2, name: "Addresses" });
    const section = heading.closest("section")!;

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(email.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("Name").compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await within(section).findByText("Home")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Save address" })).toBeInTheDocument();
  });
});
