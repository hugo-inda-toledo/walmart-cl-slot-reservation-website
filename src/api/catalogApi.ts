import type { HttpClient } from "./http/httpClient";
import type {
  CatalogDeliveryDates,
  CatalogDeliverySlots,
} from "./types/catalog";

export interface AddressQuery {
  readonly comunaCode: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

function pairedCoordinates(
  query: AddressQuery,
): Record<string, string | number> {
  const base = { comunaCode: query.comunaCode };
  return query.latitude === undefined || query.longitude === undefined
    ? base
    : { ...base, latitude: query.latitude, longitude: query.longitude };
}

export interface CatalogApi {
  listDeliveryDates(query: AddressQuery): Promise<CatalogDeliveryDates>;
  listDeliverySlots(
    date: string,
    query: AddressQuery,
  ): Promise<CatalogDeliverySlots>;
}

export function createCatalogApi(http: HttpClient): CatalogApi {
  return {
    async listDeliveryDates(query) {
      return (
        await http.request<CatalogDeliveryDates>({
          method: "GET",
          path: "/api/v1/delivery-dates",
          query: pairedCoordinates(query),
        })
      ).data;
    },
    async listDeliverySlots(date, query) {
      return (
        await http.request<CatalogDeliverySlots>({
          method: "GET",
          path: `/api/v1/delivery-dates/${encodeURIComponent(date)}/slots`,
          query: pairedCoordinates(query),
        })
      ).data;
    },
  };
}
