import { withIdempotentRetry } from "./http/idempotentRetry";
import type { HttpClient } from "./http/httpClient";
import type { Booking, SlotHold } from "./types/reservation";

export interface ReservationApi {
  createHold(
    customerId: string,
    idempotencyKey: string,
    request: { readonly slotId: string; readonly orderId: string },
  ): Promise<SlotHold>;
  getHold(customerId: string, holdId: string): Promise<SlotHold>;
  releaseHold(customerId: string, holdId: string): Promise<void>;
  confirmHold(
    customerId: string,
    holdId: string,
    idempotencyKey: string,
  ): Promise<Booking>;
  getReservation(customerId: string, reservationId: string): Promise<Booking>;
}

const networkOnlyRetry = {
  maxNetworkRetries: 2,
  networkBackoffMs: [500, 1000],
  maxInProgressRetries: 0,
  maxWaitSeconds: 10,
} as const;

export function createReservationApi(http: HttpClient): ReservationApi {
  return {
    async createHold(customerId, idempotencyKey, request) {
      return withIdempotentRetry(
        async () =>
          (
            await http.request<SlotHold>({
              method: "POST",
              path: "/api/v1/slot-holds",
              customerId,
              idempotencyKey,
              body: request,
            })
          ).data,
      );
    },
    async getHold(customerId, holdId) {
      return (
        await http.request<SlotHold>({
          method: "GET",
          path: `/api/v1/slot-holds/${encodeURIComponent(holdId)}`,
          customerId,
        })
      ).data;
    },
    async releaseHold(customerId, holdId) {
      await withIdempotentRetry(
        async () =>
          (
            await http.request<undefined>({
              method: "DELETE",
              path: `/api/v1/slot-holds/${encodeURIComponent(holdId)}`,
              customerId,
            })
          ).data,
        networkOnlyRetry,
      );
    },
    async confirmHold(customerId, holdId, idempotencyKey) {
      return withIdempotentRetry(
        async () =>
          (
            await http.request<Booking>({
              method: "POST",
              path: `/api/v1/slot-holds/${encodeURIComponent(holdId)}/confirm`,
              customerId,
              idempotencyKey,
            })
          ).data,
      );
    },
    async getReservation(customerId, reservationId) {
      return (
        await http.request<Booking>({
          method: "GET",
          path: `/api/v1/reservations/${encodeURIComponent(reservationId)}`,
          customerId,
        })
      ).data;
    },
  };
}
