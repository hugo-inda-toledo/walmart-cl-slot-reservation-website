import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { expectNoAxeViolations } from "@/test/axe";
import { server } from "@/test/msw/server";

import {
  AddressCard,
  AddressPicker,
  NotCoveredState,
} from "./AddressComponents";

const address = {
  source: "demo" as const,
  street: "Monjitas",
  number: "500",
  comuna: { code: "13101", name: "Santiago declarada" },
  resolvedComuna: { code: "13101", name: "Santiago resuelta" },
  zone: { id: "zone", code: "RM", name: "RM" },
  query: { comunaCode: "13101" },
};

describe("componentes de dirección", () => {
  it("muestra la comuna resuelta y el motivo de falta de cobertura", async () => {
    const { container } = renderWithProviders(
      <>
        <AddressCard
          customerName="Pedro Perez"
          address={address}
          onChange={vi.fn()}
        />
        <NotCoveredState reason="COMUNA_NOT_SERVED" onChange={vi.fn()} />
      </>,
    );
    expect(screen.getByText("Santiago resuelta")).toBeInTheDocument();
    expect(screen.getByText(/aún no despachamos/i)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("muestra errores de API junto al formulario y enfoca el primero", async () => {
    renderWithProviders(
      <AddressPicker
        open
        onSelect={vi.fn()}
        apiErrors={{ street: "Calle inválida" }}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Calle inválida",
    );
    expect(screen.getAllByRole("textbox")[0]).toHaveFocus();
  });

  it("muestra el selector de dirección dentro del flujo y no como modal", async () => {
    renderWithProviders(<AddressPicker open onSelect={vi.fn()} />);

    expect(
      await screen.findByRole("region", { name: "Cambiar dirección" }),
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mantiene comuna deshabilitada, la filtra por región y muestra errores locales", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddressPicker open onSelect={vi.fn()} />);
    const comuna = await screen.findByLabelText("Comuna");
    expect(comuna).toBeDisabled();
    await screen.findByRole("option", { name: "Región Metropolitana" });
    await user.selectOptions(screen.getByLabelText("Región"), "13");
    await waitFor(() => expect(comuna).toBeEnabled());
    expect(
      screen.getByRole("option", { name: "Santiago" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usar dirección" }));
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    expect(comuna).toHaveFocus();
  });

  it("omite las coordenadas nulas de una dirección demo", async () => {
    server.use(
      http.get("*/api/v1/demo-addresses", () =>
        HttpResponse.json([
          {
            id: "vina-sin-cobertura",
            label: "Av. Libertad 100, Viña del Mar",
            street: "Av. Libertad",
            number: "100",
            comuna: { code: "05109", name: "Viña del Mar" },
            latitude: null,
            longitude: null,
            expected: { covered: true, zoneCode: "LIDER_REGION_05" },
          },
        ]),
      ),
    );
    const onSelect = vi.fn();
    renderWithProviders(<AddressPicker open onSelect={onSelect} />);
    await userEvent.click(
      await screen.findByRole("button", { name: /Viña del Mar/ }),
    );
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
    const selected = onSelect.mock.calls[0]?.[0] as object;
    expect(selected).not.toHaveProperty("latitude");
    expect(selected).not.toHaveProperty("longitude");
  });
});
