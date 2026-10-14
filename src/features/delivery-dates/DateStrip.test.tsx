import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { expectNoAxeViolations } from "@/test/axe";

import { DateStrip } from "./DateStrip";

const dates = {
  zone: { id: "zone", code: "RM", name: "RM" },
  comuna: { code: "13101", name: "Santiago" },
  timeZone: "America/Santiago" as const,
  dates: [
    { date: "2030-01-15", label: "Martes", status: "AVAILABLE" as const },
    { date: "2030-01-16", label: "Miércoles", status: "SOLD_OUT" as const },
  ],
};

describe("DateStrip", () => {
  it("muestra fechas disponibles y agotadas sin permitir seleccionar la agotada", async () => {
    const { container } = renderWithProviders(
      <DateStrip
        dates={dates}
        selectedDate="2030-01-15"
        isLoading={false}
        error={null}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
        onChangeAddress={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("radio", { name: /martes 15 ene, disponible/i }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: /miércoles 16 ene, agotado/i }),
    ).toHaveAttribute("aria-disabled", "true");
    await expectNoAxeViolations(container);
  });

  it("expone carga, error reintentable, vacío y scroll propio", () => {
    const retry = vi.fn();
    const changeAddress = vi.fn();
    const { rerender } = renderWithProviders(
      <DateStrip
        dates={undefined}
        selectedDate={null}
        isLoading
        error={null}
        onSelect={vi.fn()}
        onRetry={retry}
        onChangeAddress={changeAddress}
      />,
    );
    expect(screen.getByText("Cargando fechas…")).toBeInTheDocument();
    rerender(
      <DateStrip
        dates={undefined}
        selectedDate={null}
        isLoading={false}
        error={new Error("falló")}
        onSelect={vi.fn()}
        onRetry={retry}
        onChangeAddress={changeAddress}
      />,
    );
    screen.getByRole("button", { name: "Reintentar" }).click();
    expect(retry).toHaveBeenCalledOnce();
    rerender(
      <DateStrip
        dates={{
          ...dates,
          dates: [
            { date: "2030-01-16", label: "Miércoles", status: "NO_SERVICE" },
          ],
        }}
        selectedDate={null}
        isLoading={false}
        error={null}
        onSelect={vi.fn()}
        onRetry={retry}
        onChangeAddress={changeAddress}
      />,
    );
    expect(screen.getByText(/no hay fechas con despacho/i)).toBeInTheDocument();
    rerender(
      <DateStrip
        dates={dates}
        selectedDate="2030-01-15"
        isLoading={false}
        error={null}
        onSelect={vi.fn()}
        onRetry={retry}
        onChangeAddress={changeAddress}
      />,
    );
    expect(screen.getByTestId("delivery-date-strip")).toHaveClass(
      "delivery-date-strip",
    );
  });
});
