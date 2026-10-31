import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "../lib/session";
import type { UserProfile } from "../lib/types";

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function noBodyResponse(status: number) {
  return {
    ok: status < 400,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
  } as Response;
}

const profile: UserProfile = {
  id: "usr_1",
  email: "sam@example.com",
  name: "Sam Sample",
  phone: null,
  role: "USER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function Probe() {
  const session = useSession();
  return (
    <div>
      <p>Loading: {String(session.loading)}</p>
      <p>Profile: {session.profile ? session.profile.name : "none"}</p>
      <button onClick={() => void session.signOut()}>Sign out</button>
    </div>
  );
}

describe("SessionProvider / useSession", () => {
  it("LOGIN-051: exposes loading: true before the request settles", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByText("Loading: true")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("LOGIN-052: exposes the fetched profile once it resolves", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, profile)));
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText("Profile: Sam Sample")).toBeInTheDocument();
    expect(screen.getByText("Loading: false")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("LOGIN-053: a 401 leaves profile null and loading false, without surfacing an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(401, { code: "UNAUTHENTICATED", message: "Sign in required", fieldErrors: null }),
      ),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByText("Loading: false")).toBeInTheDocument());
    expect(screen.getByText("Profile: none")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("LOGIN-054: a 500 also leaves profile null and does not throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(500, { code: "INTERNAL_ERROR", message: "Something broke", fieldErrors: null }),
      ),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByText("Loading: false")).toBeInTheDocument());
    expect(screen.getByText("Profile: none")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("LOGIN-055: signOut() posts to /auth/logout and then re-reads /users/me", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, profile));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText("Profile: Sam Sample");
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(noBodyResponse(204));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, profile));

    fireEvent.click(screen.getByText("Sign out"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/logout");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(String(fetchMock.mock.calls[1][0])).toContain("/users/me");
    vi.unstubAllGlobals();
  });

  it("LOGIN-056: requests GET /users/me exactly once on mount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, profile));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText("Profile: Sam Sample");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
