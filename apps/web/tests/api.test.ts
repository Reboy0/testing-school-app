import { describe, expect, it, vi, afterEach } from "vitest";
import { apiFetch, ApiError } from "../lib/api";

function mockResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("XC-034: sends credentials so the API's httpOnly cookies are included", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, { id: "usr_1" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/users/me");

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("XC-035: returns the parsed body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(200, { id: "usr_1" })));
    expect(await apiFetch<{ id: string }>("/users/me")).toEqual({ id: "usr_1" });
  });

  it("XC-036: throws an ApiError carrying code, message and fieldErrors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      mockResponse(400, {
        code: "VALIDATION_FAILED",
        message: "Check the highlighted fields",
        fieldErrors: { password: ["Password must contain a digit"] },
      }),
    ));

    const error = await apiFetch("/auth/register", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fieldErrors).toEqual({ password: ["Password must contain a digit"] });
  });

  it("XC-037: throws an ApiError with null fieldErrors when the body has none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      mockResponse(401, { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect", fieldErrors: null }),
    ));

    const error = await apiFetch("/auth/login", { method: "POST" }).catch((e) => e);

    expect(error.fieldErrors).toBeNull();
    expect(error.message).toBe("Email or password is incorrect");
  });

  it("XC-038: returns undefined for a 204 with no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 204,
      json: async () => { throw new SyntaxError("Unexpected end of JSON input"); },
    } as unknown as Response));

    await expect(apiFetch("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("XC-039: sends caller-supplied plain-object headers alongside the default Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, { id: "usr_1" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/users/me", { headers: { "X-Custom": "value" } });

    const sentHeaders = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(sentHeaders.get("x-custom")).toBe("value");
    expect(sentHeaders.get("content-type")).toBe("application/json");
  });

  it("XC-040: lets a caller-supplied Headers instance override the default Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, { id: "usr_1" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/users/me", { headers: new Headers({ "Content-Type": "text/plain" }) });

    const sentHeaders = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(sentHeaders.get("content-type")).toBe("text/plain");
  });
});
