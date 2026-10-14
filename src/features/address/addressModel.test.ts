import { describe, expect, it } from "vitest";

import { notCoveredMessages, validateAddressForm } from "./addressModel";

describe("addressModel", () => {
  it("valida los campos locales sin aceptar espacios", () => {
    expect(
      validateAddressForm({ street: "  ", number: "", comunaCode: "" }),
    ).toEqual({
      street: "Ingresa una calle válida.",
      number: "Ingresa un número válido.",
      comunaCode: "Selecciona una comuna.",
    });
  });

  it("traduce cada motivo de falta de cobertura", () => {
    expect(notCoveredMessages).toEqual({
      EXCLUDED_AREA: "La dirección está en un área sin despacho.",
      OUTSIDE_SERVICE_AREA:
        "La dirección está fuera de nuestra área de despacho.",
      COMUNA_NOT_SERVED: "Aún no despachamos en esta comuna.",
      ZONE_INACTIVE: "El despacho en esta zona está suspendido temporalmente.",
    });
  });
});
