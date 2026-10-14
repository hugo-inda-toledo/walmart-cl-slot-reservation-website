import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createServerClock } from "@/api/http/serverClock";
import { renderWithProviders } from "@/test/renderWithProviders";

import { Countdown } from "./Countdown";

describe("Countdown", () => {
  it("oculta el valor visual y anuncia minutos y los últimos segundos sin repetir", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    const clock = createServerClock(() => Date.now());
    renderWithProviders(
      <Countdown
        expiresAt="2026-10-12T12:02:01Z"
        clock={clock}
        onElapsed={vi.fn()}
      />,
    );

    expect(screen.getByText("02:01")).toHaveAttribute("aria-hidden", "true");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("Quedan 2 minutos")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(screen.getByText("Quedan 30 segundos")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText("Quedan 30 segundos")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByText("Quedan 20 segundos")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("Quedan 10 segundos")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
