import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { createApiClient } from "./apiClient";
import { ApiClientProvider, useApiClient } from "./ApiClientProvider";
import { createHttpClient } from "./http/httpClient";
import { queryKeys } from "./queryKeys";
import { server } from "@/test/msw/server";

const ids = {
  hold: "44444444-4444-4444-8444-444444444444",
  reservation: "55555555-5555-4555-8555-555555555555",
} as const;

describe("ApiClient", () => {
  it("expone los módulos de contexto sobre el cliente HTTP", () => {
    const api = createApiClient(createHttpClient({ baseUrl: "" }));

    expect(api.geo).toBeDefined();
    expect(api.catalog).toBeDefined();
    expect(api.reservation).toBeDefined();
  });

  it("llama las once operaciones contra el registro de fixtures con path, query, headers y cuerpos del contrato", async () => {
    const seen: { method: string; url: URL; request: Request }[] = [];
    server.events.on("request:start", ({ request }) => {
      seen.push({
        method: request.method,
        url: new URL(request.url),
        request: request.clone(),
      });
    });
    const customerId = "pedro-perez";
    const idempotencyKey = "hold-key";
    const api = createApiClient(createHttpClient({ baseUrl: "" }));

    await api.geo.listRegions();
    await api.geo.listComunas("13");
    await api.geo.listDemoAddresses();
    await api.geo.resolveCoverage({
      street: "Monjitas",
      number: "500",
      comunaCode: "13101",
      latitude: -33.43,
    });
    await api.catalog.listDeliveryDates({
      comunaCode: "13101",
      latitude: -33.43,
      longitude: -70.65,
    });
    await api.catalog.listDeliverySlots("2030-01-15", { comunaCode: "13101" });
    const hold = await api.reservation.createHold(customerId, idempotencyKey, {
      slotId: "22222222-2222-4222-8222-222222222222",
      orderId: "order-1",
    });
    await api.reservation.getHold(customerId, ids.hold);
    await api.reservation.releaseHold(customerId, ids.hold);
    const booking = await api.reservation.confirmHold(
      customerId,
      ids.hold,
      idempotencyKey,
    );
    await api.reservation.getReservation(customerId, ids.reservation);
    server.events.removeAllListeners();

    expect(hold.holdId).toBeDefined();
    expect(booking.reservationId).toBeDefined();
    expect(
      seen.map(({ method, url }) => `${method} ${url.pathname}${url.search}`),
    ).toEqual([
      "GET /api/v1/regions",
      "GET /api/v1/regions/13/comunas",
      "GET /api/v1/demo-addresses",
      "POST /api/v1/coverage/resolve",
      "GET /api/v1/delivery-dates?comunaCode=13101&latitude=-33.43&longitude=-70.65",
      "GET /api/v1/delivery-dates/2030-01-15/slots?comunaCode=13101",
      "POST /api/v1/slot-holds",
      `GET /api/v1/slot-holds/${ids.hold}`,
      `DELETE /api/v1/slot-holds/${ids.hold}`,
      `POST /api/v1/slot-holds/${ids.hold}/confirm`,
      `GET /api/v1/reservations/${ids.reservation}`,
    ]);
    const [resolve, , , create, get, release, confirm, reservation] = [
      seen[3],
      seen[4],
      seen[5],
      seen[6],
      seen[7],
      seen[8],
      seen[9],
      seen[10],
    ];
    // Una coordenada sin su par no se envía (solo viajan pares lat/lon).
    expect(await resolve?.request.json()).toEqual({
      street: "Monjitas",
      number: "500",
      comunaCode: "13101",
    });
    expect(await create?.request.json()).toEqual({
      slotId: "22222222-2222-4222-8222-222222222222",
      orderId: "order-1",
    });
    expect(create?.request.headers.get("X-Customer-Id")).toBe(customerId);
    expect(create?.request.headers.get("Idempotency-Key")).toBe(idempotencyKey);
    expect(confirm?.request.headers.get("Idempotency-Key")).toBe(
      idempotencyKey,
    );
    for (const call of [get, release, confirm, reservation]) {
      expect(call?.request.headers.get("X-Customer-Id")).toBe(customerId);
    }
    expect(get?.request.headers.get("Idempotency-Key")).toBeNull();
    expect(release?.request.headers.get("Idempotency-Key")).toBeNull();
  });

  it("falla explícitamente al consumir el contexto sin provider", () => {
    expect(() => renderHook(() => useApiClient())).toThrow("ApiClientProvider");
  });

  it("entrega el cliente por el provider y conserva claves compartidas estables", () => {
    const client = createApiClient(createHttpClient({ baseUrl: "" }));
    const { result } = renderHook(() => useApiClient(), {
      wrapper: ({ children }) =>
        createElement(ApiClientProvider, { client }, children),
    });

    expect(result.current).toBe(client);
    expect(queryKeys.geo.regions).toEqual(["geo", "regions"]);
    expect(
      queryKeys.catalog.slots("2030-01-15", { comunaCode: "13101" }),
    ).toEqual(["catalog", "slots", "2030-01-15", { comunaCode: "13101" }]);
  });
});
