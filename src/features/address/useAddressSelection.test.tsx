import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";

import { useAddressSelection } from "./useAddressSelection";

function Probe() {
  const selection = useAddressSelection();
  return (
    <>
      <output>{selection.status.kind}</output>
      <span data-testid="street-field-error">
        {selection.status.kind === "invalid"
          ? (selection.status.fieldErrors.street ?? "no-street-error")
          : "no-field-errors"}
      </span>
      <button
        onClick={() => {
          void selection.submit({
            source: "demo",
            street: "Monjitas",
            number: "500",
            comuna: { code: "13101", name: "Santiago" },
            latitude: -33.43,
            longitude: -70.65,
          });
        }}
      >
        Verificar
      </button>
      <button
        onClick={() => {
          void selection.submit({
            source: "manual",
            street: "Monjitas",
            number: "500",
            comuna: { code: "13101", name: "Santiago" },
          });
        }}
      >
        Sin coordenadas
      </button>
      <button
        onClick={() => {
          selection.markNotCovered("COMUNA_NOT_SERVED");
        }}
      >
        Sin cobertura
      </button>
    </>
  );
}

describe("useAddressSelection", () => {
  it("verifica con coordenadas, persiste y puede marcar falta de cobertura", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Probe />);
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("covered"),
    );
    expect(sessionStorage.getItem("wcsr:address")).toContain("Monjitas");
    await user.click(screen.getByRole("button", { name: "Sin coordenadas" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("covered"),
    );
    await user.click(screen.getByRole("button", { name: "Sin cobertura" }));
    expect(screen.getByRole("status")).toHaveTextContent("notCovered");
  });

  it("mapea una respuesta 422 a falta de cobertura", async () => {
    server.use(
      http.post("/api/v1/coverage/resolve", () =>
        HttpResponse.json(
          {
            title: "No cubierta",
            status: 422,
            code: "ADDRESS_NOT_COVERED",
            reason: "COMUNA_NOT_SERVED",
          },
          {
            status: 422,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Probe />);
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("notCovered"),
    );
    expect(sessionStorage.getItem("wcsr:address")).toContain("Monjitas");
  });

  it.each(["EXCLUDED_AREA", "OUTSIDE_SERVICE_AREA", "ZONE_INACTIVE"] as const)(
    "mapea el motivo %s",
    async (reason) => {
      server.use(
        http.post("/api/v1/coverage/resolve", () =>
          HttpResponse.json(
            {
              title: "No cubierta",
              status: 422,
              code: "ADDRESS_NOT_COVERED",
              reason,
            },
            {
              status: 422,
              headers: { "Content-Type": "application/problem+json" },
            },
          ),
        ),
      );
      const user = userEvent.setup();
      renderWithProviders(<Probe />);
      await user.click(screen.getByRole("button", { name: "Verificar" }));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("notCovered"),
      );
    },
  );

  it.each([
    [
      "VALIDATION_ERROR",
      { errors: [{ field: "street", message: "Calle inválida" }] },
    ],
    ["UNKNOWN_COMUNA", { comunaCode: "99999" }],
  ])("convierte %s en estado inválido", async (code, extensions) => {
    server.use(
      http.post("/api/v1/coverage/resolve", () =>
        HttpResponse.json(
          { title: "Inválida", status: 400, code, ...extensions },
          {
            status: 400,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Probe />);
    await user.click(screen.getByRole("button", { name: "Verificar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("invalid"),
    );
    if (code === "VALIDATION_ERROR")
      expect(screen.getByTestId("street-field-error")).toHaveTextContent(
        "Calle inválida",
      );
  });

  it("restaura la dirección de sesión y vuelve a verificarla", async () => {
    sessionStorage.setItem(
      "wcsr:address",
      JSON.stringify({
        source: "manual",
        street: "Monjitas",
        number: "500",
        comuna: { code: "13101", name: "Santiago" },
      }),
    );
    renderWithProviders(<Probe />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("covered"),
    );
  });
});
