import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createServerClock } from "@/api/http/serverClock";

import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  it("recalcula desde el reloj del servidor sin acumular deriva", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    const clock = createServerClock(() => Date.now());
    clock.observe("Mon, 12 Oct 2026 12:05:00 GMT", Date.now(), Date.now());
    const expiresAt = "2026-10-12T12:06:00Z";
    const onElapsed = vi.fn();
    const { result } = renderHook(() =>
      useCountdown(expiresAt, clock, onElapsed),
    );

    expect(result.current).toMatchObject({
      remainingMs: 60_000,
      expired: false,
      label: "01:00",
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
      vi.setSystemTime(new Date("2026-10-12T12:00:30Z"));
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.remainingMs).toBe(29_000);
    expect(result.current.label).toBe("00:29");
    expect(onElapsed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("vence exactamente una vez al llegar a cero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    const clock = createServerClock(() => Date.now());
    const onElapsed = vi.fn();
    const { result } = renderHook(() =>
      useCountdown("2026-10-12T12:00:02Z", clock, onElapsed),
    );

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current).toMatchObject({
      remainingMs: 0,
      expired: true,
      label: "00:00",
    });
    expect(onElapsed).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onElapsed).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
