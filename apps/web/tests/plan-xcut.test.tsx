/**
 * Cross-cutting component cases from docs/test-plan.md: labels and field
 * errors on every form (C-USER-01, C-USER-04, C-USER-05, C-USER-07, C-CAT-02),
 * the API client (C-ERR-01) and the palette check (U-THEME-01).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddressForm } from "../components/AddressForm";
import { CatalogueFilters } from "../components/CatalogueFilters";
import { ProfileForm } from "../components/ProfileForm";
import { apiFetch, ApiError } from "../lib/api";
import { deferred, jsonResponse, sam, stubApi } from "./plan-helpers";

beforeEach(() => {
  vi.unstubAllGlobals();
});

const errorsFor = (input: HTMLElement) => {
  const id = input.getAttribute("aria-describedby");
  return id ? document.getElementById(id) : null;
};

const ADDRESS_LABELS = ["Label", "Street address", "City", "Postal code", "Country"];

describe("labels", () => {
  it("XC-02 C-USER-01: every profile field is found by its label", () => {
    render(<ProfileForm profile={sam} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
  });

  it("XC-02 C-USER-05: all five address fields are found by their labels", () => {
    render(<AddressForm onCreated={vi.fn()} />);

    for (const label of ADDRESS_LABELS) {
      expect(screen.getByLabelText(new RegExp(label, "i"))).toBeInstanceOf(HTMLInputElement);
    }
  });

  it("XC-02 C-CAT-02: search, category, both prices and sort all have labels", () => {
    render(
      <CatalogueFilters
        categories={[]}
        value={{ q: "", category: "", minPrice: "", maxPrice: "", sort: "name_asc" }}
        onChange={vi.fn()}
      />,
    );

    for (const label of ["Search", "Category", "Lowest price (cents)", "Highest price (cents)", "Sort by"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});

describe("field errors", () => {
  it("XC-01 C-USER-04: fieldErrors.phone appears beside the phone field", async () => {
    stubApi(() =>
      jsonResponse(400, { code: "VALIDATION_FAILED", message: "Check the highlighted fields", fieldErrors: { phone: ["Enter a valid phone number"] } }),
    );
    render(<ProfileForm profile={sam} />);

    await userEvent.type(screen.getByLabelText("Phone"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const phone = screen.getByLabelText("Phone");
    await waitFor(() => expect(phone).toHaveAttribute("aria-invalid", "true"));
    expect(errorsFor(phone)).toHaveTextContent("Enter a valid phone number");
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });

  it("XC-01 C-USER-07: fieldErrors appear beside the address field they name, and the button is disabled while the request is in flight", async () => {
    const pending = deferred<Response>();
    stubApi(() => pending.promise);
    render(<AddressForm onCreated={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    pending.resolve(
      jsonResponse(400, {
        code: "VALIDATION_FAILED",
        message: "Check the highlighted fields",
        fieldErrors: { city: ["City is required"], country: ["Use a two-letter country code"] },
      }),
    );

    const city = document.querySelector<HTMLInputElement>('[name="city"]')!;
    const country = document.querySelector<HTMLInputElement>('[name="country"]')!;
    await waitFor(() => expect(city).toHaveAttribute("aria-invalid", "true"));
    expect(errorsFor(city)).toHaveTextContent("City is required");
    expect(errorsFor(country)).toHaveTextContent("Use a two-letter country code");
    expect(document.querySelector('[name="label"]')).not.toHaveAttribute("aria-invalid");
  });
});

describe("apiFetch", () => {
  it("XC-05 C-ERR-01: parses a success, returns undefined for 204, raises ApiError with or without fieldErrors, and always sends JSON with credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: 1 }))
      .mockResolvedValueOnce(jsonResponse(204))
      .mockResolvedValueOnce(jsonResponse(400, { code: "VALIDATION_FAILED", message: "Check the form", fieldErrors: { email: ["Bad"] } }))
      .mockResolvedValueOnce(jsonResponse(403, { code: "FORBIDDEN", message: "No", fieldErrors: null }))
      .mockResolvedValueOnce(jsonResponse(502));
    vi.stubGlobal("fetch", fetchMock);

    expect(await apiFetch("/a")).toEqual({ ok: 1 });
    expect(await apiFetch("/b", { method: "DELETE" })).toBeUndefined();

    const validation = await apiFetch("/c").catch((error: unknown) => error);
    expect(validation).toBeInstanceOf(ApiError);
    expect(validation).toMatchObject({ status: 400, code: "VALIDATION_FAILED", message: "Check the form", fieldErrors: { email: ["Bad"] } });

    const forbidden = await apiFetch("/d").catch((error: unknown) => error);
    expect(forbidden).toMatchObject({ status: 403, code: "FORBIDDEN", message: "No", fieldErrors: null });

    const gateway = await apiFetch("/e").catch((error: unknown) => error);
    expect(gateway).toMatchObject({ status: 502, code: "UNKNOWN", fieldErrors: null });

    for (const [, init] of fetchMock.mock.calls) {
      expect(init.credentials).toBe("include");
      expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    }
  });
});

describe("palette", () => {
  const webRoot = path.resolve(__dirname, "..");

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.(tsx?|jsx?)$/.test(entry) ? [full] : [];
    });
  }

  const TAILWIND_PALETTE =
    /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|placeholder|shadow|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;
  const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;

  it("TH-04 U-THEME-01: no component or page names a colour outside the shared palette", () => {
    const offenders: string[] = [];
    for (const file of [...sources(path.join(webRoot, "components")), ...sources(path.join(webRoot, "app"))]) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((text, index) => {
          if (LITERAL.test(text) || TAILWIND_PALETTE.test(text)) offenders.push(`${path.relative(webRoot, file)}:${index + 1}: ${text.trim()}`);
        });
    }

    expect(offenders).toEqual([]);
  });
});
