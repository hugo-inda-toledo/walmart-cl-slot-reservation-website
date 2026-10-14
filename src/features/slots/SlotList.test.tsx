import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { expectNoAxeViolations } from "@/test/axe";

import { SlotList } from "./SlotList";

const slots = {
  zone: { id: "zone", code: "RM", name: "RM" },
  comuna: { code: "13101", name: "Santiago" },
  date: "2030-01-15",
  label: "Martes",
  status: "AVAILABLE" as const,
  timeZone: "America/Santiago" as const,
  slots: [
    {
      slotId: "one",
      start: "2030-01-15T12:00:00-03:00",
      end: "2030-01-15T14:00:00-03:00",
      price: 2990,
      remainingCapacity: 3,
      status: "AVAILABLE" as const,
    },
    {
      slotId: "two",
      start: "2030-01-15T14:00:00-03:00",
      end: "2030-01-15T16:00:00-03:00",
      price: 2990,
      remainingCapacity: 0,
      status: "SOLD_OUT" as const,
    },
  ],
};

describe("SlotList", () => {
  it("muestra cupos bajos y expone agotados sin selección", async () => {
    const { container } = renderWithProviders(
      <SlotList
        slots={slots}
        selectedSlotId="one"
        isLoading={false}
        error={null}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("radio", {
        name: /12:00pm-2:00pm, \$2\.990, disponible/i,
      }),
    ).toHaveTextContent("Quedan 3 cupos");
    expect(screen.getByRole("radio", { name: /agotado/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expectNoAxeViolations(container);
  });

  it("muestra carga, error, vacío y fuera de plazo", () => {
    const retry = vi.fn();
    const { rerender } = renderWithProviders(
      <SlotList
        slots={undefined}
        selectedSlotId={null}
        isLoading
        error={null}
        onSelect={vi.fn()}
        onRetry={retry}
      />,
    );
    expect(screen.getByText("Cargando horarios…")).toBeInTheDocument();
    rerender(
      <SlotList
        slots={undefined}
        selectedSlotId={null}
        isLoading={false}
        error={new Error("falló")}
        onSelect={vi.fn()}
        onRetry={retry}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    rerender(
      <SlotList
        slots={{
          ...slots,
          slots: [
            {
              slotId: "late",
              start: "2030-01-15T12:00:00-03:00",
              end: "2030-01-15T14:00:00-03:00",
              price: 2990,
              remainingCapacity: 0,
              status: "CUTOFF_PASSED",
            },
          ],
        }}
        selectedSlotId={null}
        isLoading={false}
        error={null}
        onSelect={vi.fn()}
        onRetry={retry}
      />,
    );
    expect(screen.getByText(/elige otra fecha/i)).toBeInTheDocument();
  });
});
