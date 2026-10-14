import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { useSlotSelection } from "./useSlotSelection";

function Probe() {
  const selection = useSlotSelection("2030-01-15", {
    query: { comunaCode: "13101" },
  });
  return (
    <>
      <output>{selection.selectedSlot?.slotId ?? "none"}</output>
      <button
        onClick={() => {
          selection.preselect("62222222-2222-4222-8222-222222222222");
        }}
      >
        Preseleccionar
      </button>
      <button onClick={() => void selection.retry()}>Refrescar</button>
      <button
        onClick={() => {
          selection.select("62222222-2222-4222-8222-222222222222");
        }}
      >
        Seleccionar
      </button>
      <button
        onClick={() => {
          selection.clear();
        }}
      >
        Limpiar
      </button>
    </>
  );
}
describe("useSlotSelection", () => {
  it("carga bloques desde MSW y aplica una preselección disponible", async () => {
    renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Preseleccionar" }),
      ).toBeInTheDocument(),
    );
    screen.getByRole("button", { name: "Preseleccionar" }).click();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "62222222-2222-4222-8222-222222222222",
      ),
    );
    screen.getByRole("button", { name: "Limpiar" }).click();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("none"),
    );
    screen.getByRole("button", { name: "Preseleccionar" }).click();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "62222222-2222-4222-8222-222222222222",
      ),
    );
  });

  it("deselecciona el bloque cuando deja de estar disponible tras refrescar", async () => {
    renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Seleccionar" }),
      ).toBeInTheDocument(),
    );
    screen.getByRole("button", { name: "Preseleccionar" }).click();
    await waitFor(() =>
      expect(screen.getByRole("status")).not.toHaveTextContent("none"),
    );
    server.use(
      http.get("/api/v1/delivery-dates/:date/slots", () =>
        HttpResponse.json({
          zone: { id: "zone", code: "RM", name: "RM" },
          comuna: { code: "13101", name: "Santiago" },
          date: "2030-01-15",
          label: "Martes",
          status: "AVAILABLE",
          timeZone: "America/Santiago",
          slots: [
            {
              slotId: "62222222-2222-4222-8222-222222222222",
              start: "2030-01-15T12:00:00-03:00",
              end: "2030-01-15T14:00:00-03:00",
              price: 2990,
              remainingCapacity: 0,
              status: "SOLD_OUT",
            },
          ],
        }),
      ),
    );
    screen.getByRole("button", { name: "Refrescar" }).click();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("none"),
    );
  });
});
