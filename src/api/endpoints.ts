export type HttpMethod = "GET" | "POST" | "DELETE";

export interface Endpoint {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly e2eOnly?: true;
}

export const endpoints: readonly Endpoint[] = [
  { operationId: "listRegions", method: "GET", path: "/api/v1/regions" },
  {
    operationId: "listComunasByRegion",
    method: "GET",
    path: "/api/v1/regions/{regionCode}/comunas",
  },
  {
    operationId: "listDemoAddresses",
    method: "GET",
    path: "/api/v1/demo-addresses",
  },
  {
    operationId: "resolveCoverage",
    method: "POST",
    path: "/api/v1/coverage/resolve",
  },
  {
    operationId: "listDeliveryDates",
    method: "GET",
    path: "/api/v1/delivery-dates",
  },
  {
    operationId: "listDeliverySlots",
    method: "GET",
    path: "/api/v1/delivery-dates/{date}/slots",
  },
  { operationId: "createSlotHold", method: "POST", path: "/api/v1/slot-holds" },
  {
    operationId: "getSlotHold",
    method: "GET",
    path: "/api/v1/slot-holds/{holdId}",
  },
  {
    operationId: "releaseSlotHold",
    method: "DELETE",
    path: "/api/v1/slot-holds/{holdId}",
  },
  {
    operationId: "confirmSlotHold",
    method: "POST",
    path: "/api/v1/slot-holds/{holdId}/confirm",
  },
  {
    operationId: "getReservation",
    method: "GET",
    path: "/api/v1/reservations/{reservationId}",
  },
  {
    operationId: "cancelReservation",
    method: "POST",
    path: "/api/v1/reservations/{reservationId}/cancel",
    e2eOnly: true,
  },
];
