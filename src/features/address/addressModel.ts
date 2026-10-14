import type { AddressQuery } from "@/api/catalogApi";
import type { ApiError } from "@/api/http/apiError";
import type {
  GeoComunaRef,
  GeoNotCoveredReason,
  GeoZoneRef,
} from "@/api/types/geo";

export type AddressField = "street" | "number" | "comunaCode";
export interface AddressFormInput {
  readonly street: string;
  readonly number: string;
  readonly comunaCode: string;
}
export interface SelectedAddress {
  readonly source: "demo" | "manual";
  readonly demoId?: string;
  readonly street: string;
  readonly number: string;
  readonly comuna: GeoComunaRef;
  readonly latitude?: number;
  readonly longitude?: number;
}
export interface CoveredAddress extends SelectedAddress {
  readonly zone: GeoZoneRef;
  readonly resolvedComuna: GeoComunaRef;
  readonly query: AddressQuery;
}
export type AddressStatus =
  | { readonly kind: "none" }
  | { readonly kind: "checking"; readonly address: SelectedAddress }
  | { readonly kind: "covered"; readonly address: CoveredAddress }
  | {
      readonly kind: "notCovered";
      readonly address: SelectedAddress;
      readonly reason: GeoNotCoveredReason;
    }
  | {
      readonly kind: "invalid";
      readonly address: SelectedAddress;
      readonly fieldErrors: Readonly<Partial<Record<AddressField, string>>>;
    }
  | {
      readonly kind: "error";
      readonly address: SelectedAddress;
      readonly error: ApiError;
    };

export const notCoveredMessages: Readonly<Record<GeoNotCoveredReason, string>> =
  {
    EXCLUDED_AREA: "La dirección está en un área sin despacho.",
    OUTSIDE_SERVICE_AREA:
      "La dirección está fuera de nuestra área de despacho.",
    COMUNA_NOT_SERVED: "Aún no despachamos en esta comuna.",
    ZONE_INACTIVE: "El despacho en esta zona está suspendido temporalmente.",
  };

export function validateAddressForm(
  input: AddressFormInput,
): Readonly<Partial<Record<AddressField, string>>> {
  const errors: Partial<Record<AddressField, string>> = {};
  if (!input.street.trim() || input.street.length > 120)
    errors.street = "Ingresa una calle válida.";
  if (!input.number.trim() || input.number.length > 20)
    errors.number = "Ingresa un número válido.";
  if (!input.comunaCode) errors.comunaCode = "Selecciona una comuna.";
  return errors;
}
