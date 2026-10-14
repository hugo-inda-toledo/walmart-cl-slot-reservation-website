import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { useDateSelection } from "./useDateSelection";

function Probe({ comunaCode = "13101" }: { readonly comunaCode?: string }) {
  const selection = useDateSelection({ query: { comunaCode } });
  return (
    <>
      <output>{selection.selectedDate ?? "none"}</output>
      <output>{selection.notice ?? "no-notice"}</output>
      <button
        onClick={() => {
          selection.select("2030-01-16");
        }}
      >
        Agotada
      </button>
      <button onClick={() => void selection.retry()}>Refrescar</button>
      <button
        onClick={() => {
          selection.handleOutOfRange({
            minDate: "2030-01-16",
            maxDate: "2030-01-28",
          });
        }}
      >
        Rango
      </button>
    </>
  );
}
describe("useDateSelection", () => {
  it("autoselecciona la primera fecha disponible desde MSW", async () => {
    renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-15"),
    );
  });

  it("ignora fechas no disponibles y maneja la señal de rango", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-15"),
    );
    await user.click(screen.getByRole("button", { name: "Agotada" }));
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-15");
    server.use(
      http.get("/api/v1/delivery-dates", () =>
        HttpResponse.json({
          zone: { id: "zone", code: "RM", name: "RM" },
          comuna: { code: "13101", name: "Santiago" },
          timeZone: "America/Santiago",
          dates: [
            { date: "2030-01-15", label: "Martes", status: "SOLD_OUT" },
            { date: "2030-01-17", label: "Jueves", status: "AVAILABLE" },
          ],
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Rango" }));
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-17"),
    );
    expect(screen.getAllByRole("status")[1]).toHaveTextContent(
      "dateUnavailable",
    );
  });

  it("restablece el rango transitorio cuando cambia la dirección", async () => {
    const user = userEvent.setup();
    const view = renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-15"),
    );
    await user.click(screen.getByRole("button", { name: "Rango" }));
    view.rerender(<Probe comunaCode="13102" />);
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-15"),
    );
  });

  it("mueve la selección a la primera disponible tras un refresco", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-15"),
    );
    server.use(
      http.get("/api/v1/delivery-dates", () =>
        HttpResponse.json({
          zone: { id: "zone", code: "RM", name: "RM" },
          comuna: { code: "13101", name: "Santiago" },
          timeZone: "America/Santiago",
          dates: [
            { date: "2030-01-15", label: "Martes", status: "SOLD_OUT" },
            { date: "2030-01-17", label: "Jueves", status: "AVAILABLE" },
          ],
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Refrescar" }));
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("2030-01-17"),
    );
  });
});
