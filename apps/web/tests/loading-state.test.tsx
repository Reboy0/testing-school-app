import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingState } from "../components/LoadingState";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LoadingState", () => {
  it("CATL-035: says it is loading straight away", () => {
    render(<LoadingState />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("CATL-036: does not explain the wait before the escalation delay", () => {
    render(<LoadingState escalateAfterMs={6000} />);

    act(() => {
      vi.advanceTimersByTime(5999);
    });

    expect(screen.queryByText(/waking up the server/i)).not.toBeInTheDocument();
  });

  // A cold start on a sleeping free-tier service takes up to a minute. An
  // unexplained minute of "Loading…" reads as a broken page, so the message
  // escalates rather than repeating itself.
  it("CATL-037: explains the wait once the delay has passed", () => {
    render(<LoadingState escalateAfterMs={6000} />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/waking up the server/i);
    expect(screen.getByRole("status")).toHaveTextContent(/up to a minute/i);
  });

  it("CATL-038: announces itself politely rather than interrupting a screen reader", () => {
    render(<LoadingState />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  // Asserted through clearTimeout rather than through a warning: React has not
  // complained about state updates on unmounted components since 18, so a
  // surviving timer leaves no observable trace to assert on. The cleanup still
  // matters — this component is mounted and unmounted on every navigation —
  // and this is the only way to catch its absence.
  it("CATL-039: clears its escalation timer on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = render(<LoadingState escalateAfterMs={6000} />);
    const pending = vi.getTimerCount();
    unmount();

    expect(pending).toBe(1);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    clearTimeoutSpy.mockRestore();
  });
});
