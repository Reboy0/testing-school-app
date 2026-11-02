/**
 * The network seam for component tests: a stubbed fetch that records what a
 * component sent, and canned API responses.
 */
import { vi } from "vitest";

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

export const unauthenticated = () =>
  jsonResponse(401, { code: "UNAUTHENTICATED", message: "Sign in to continue", fieldErrors: null });

