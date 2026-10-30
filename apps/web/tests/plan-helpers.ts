import { vi } from "vitest";
import type { Cart, CartLine, CataloguePage, Product, UserProfile } from "../lib/types";

export function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError("Unexpected end of JSON input");
      return body;
    },
  } as Response;
}

export interface Call {
  path: string;
  method: string;
  body: unknown;
}

/**
 * Stubs fetch with a handler that sees the API path (without the origin), the
 * method and the parsed body, and records every call so a test can assert on
 * what was sent rather than only on how many times fetch ran.
 */
export function stubApi(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call = {
      path: url.pathname + url.search,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return handler(call);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock, callsTo: (path: string) => calls.filter((call) => call.path.startsWith(path)) };
}

/** A promise a test settles by hand, for holding a request in flight. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export const sam: UserProfile = {
  id: "usr_sam",
  email: "sam@example.com",
  name: "Sam Carter",
  phone: null,
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const unauthenticated = () =>
  jsonResponse(401, { code: "UNAUTHENTICATED", message: "Sign in to continue", fieldErrors: null });

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_pen",
    slug: "pen",
    name: "Pen",
    description: "A pen",
    priceCents: 350,
    discountPercent: 0,
    effectivePriceCents: 350,
    imageUrl: "/product-image/pen",
    stock: 10,
    categories: [],
    ...overrides,
  };
}

export function page(items: Product[], overrides: Partial<CataloguePage> = {}): CataloguePage {
  return { items, page: 1, pageSize: 12, total: items.length, totalPages: items.length ? 1 : 0, ...overrides };
}

export function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "cln_pen",
    productId: "prd_pen",
    slug: "pen",
    name: "Pen",
    imageUrl: "/product-image/pen",
    unitPriceCents: 350,
    discountPercent: 0,
    quantity: 1,
    lineTotalCents: 350,
    discountCents: 0,
    payableCents: 350,
    ...overrides,
  };
}

export function cartOf(lines: CartLine[]): Cart {
  const subtotalCents = lines.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const discountCents = lines.reduce((sum, item) => sum + item.discountCents, 0);
  return {
    id: lines.length ? "crt_1" : null,
    itemCount: lines.reduce((sum, item) => sum + item.quantity, 0),
    lines,
    subtotalCents,
    discountCents,
    payableCents: subtotalCents - discountCents,
  };
}
