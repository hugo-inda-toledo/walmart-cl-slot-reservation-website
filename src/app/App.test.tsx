import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("muestra marca, título y cliente demo en las tres zonas del encabezado", () => {
    render(<App />);

    const header = screen.getByRole("banner", {
      name: "Delivery Slot Reservation",
    });
    expect(header).toHaveTextContent("Walmart");
    expect(header).toHaveTextContent("Delivery Slot Reservation");
    expect(screen.getByRole("combobox", { name: "Cliente demo" })).toHaveValue(
      "pedro-perez",
    );
    expect(
      header.contains(screen.getByRole("combobox", { name: "Cliente demo" })),
    ).toBe(true);
    expect(header).not.toHaveTextContent("Ayuda");
    expect(header).not.toHaveTextContent("Mi cuenta");
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Demo técnico · Hugo Inda Toledo · 2026",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("renders the reservation heading", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Reservar horario" }),
    ).toBeInTheDocument();
  });

  it("runs tests outside the Santiago process timezone", () => {
    expect(process.env.TZ).not.toBe("America/Santiago");
  });

  it("muestra un límite de errores recuperable cuando falla el render", () => {
    function Broken() {
      throw new Error("fallo de prueba");
      return null;
    }

    render(<App content={<Broken />} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ocurrió un problema inesperado",
    );
    expect(screen.getByRole("button", { name: "Recargar" })).toBeVisible();
  });

  it("ofrece sólo despacho a domicilio y exige dirección cubierta para reservar", () => {
    render(<App />);

    expect(
      screen.getByText("Despacho a domicilio", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pickup|retiro/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Modalidad de entrega" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reservar" })).toBeDisabled();
  });
});
