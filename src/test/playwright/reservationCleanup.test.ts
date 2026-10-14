import { describe, expect, it } from "vitest";

import { assertSuccessfulCleanup } from "../../../e2e/reservationCleanup";

describe("assertSuccessfulCleanup", () => {
  it("rechaza una respuesta de limpieza no exitosa", () => {
    expect(() => {
      assertSuccessfulCleanup("cancelar la reserva", {
        ok: () => false,
        status: () => 500,
        statusText: () => "Internal Server Error",
      });
    }).toThrow("No fue posible cancelar la reserva: 500 Internal Server Error");
  });

  it("acepta una respuesta de limpieza exitosa", () => {
    expect(() => {
      assertSuccessfulCleanup("liberar la retención", {
        ok: () => true,
        status: () => 204,
        statusText: () => "No Content",
      });
    }).not.toThrow();
  });
});
