import { createCatalogApi, type CatalogApi } from "./catalogApi";
import { createGeoApi, type GeoApi } from "./geoApi";
import type { HttpClient } from "./http/httpClient";
import type { ServerClock } from "./http/serverClock";
import { createReservationApi, type ReservationApi } from "./reservationApi";

export interface ApiClient {
  readonly geo: GeoApi;
  readonly catalog: CatalogApi;
  readonly reservation: ReservationApi;
  readonly clock: ServerClock;
}

export function createApiClient(http: HttpClient): ApiClient {
  return {
    geo: createGeoApi(http),
    catalog: createCatalogApi(http),
    reservation: createReservationApi(http),
    clock: http.clock,
  };
}
