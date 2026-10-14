import { describe, expect, it } from "vitest";

import { createApiClient } from "@/api/apiClient";
import { createHttpClient } from "@/api/http/httpClient";
import { validateFixture } from "@/test/contract/fixturesConformance";

import {
  createReservationScenario,
  lostResponse,
  networkFailure,
} from "./reservationScenario";
import { server } from "./server";

const customerId = "pedro-perez";
const slotId = "22222222-2222-4222-8222-222222222222";

describe("reservationScenario", () => {
  it("retiene hasta agotar la capacidad y repite exactamente la respuesta idempotente", async () => {
    const scenario = createReservationScenario({
      capacityBySlot: { [slotId]: 1 },
    });
    server.use(...scenario.handlers);
    const api = createApiClient(createHttpClient({ baseUrl: "" }));

    const first = await api.reservation.createHold(customerId, "hold-1", {
      slotId,
      orderId: "order-1",
    });
    const repeated = await api.reservation.createHold(customerId, "hold-1", {
      slotId,
      orderId: "order-1",
    });

    expect(repeated).toEqual(first);
    await expect(
      api.reservation.createHold(customerId, "hold-2", {
        slotId,
        orderId: "order-2",
      }),
    ).rejects.toMatchObject({
      kind: "problem",
      problem: { code: "SLOT_FULL", slotId },
    });
    const emitted = scenario.responses();
    expect(emitted.length).toBeGreaterThan(0);
    for (const fixture of emitted) {
      const result = validateFixture(fixture);
      expect(result.valid, `${fixture.name}: ${result.errors.join("; ")}`).toBe(
        true,
      );
    }
  });

  it("permite programar una caída de red y respuestas del registro", async () => {
    const scenario = createReservationScenario({
      responses: {
        createSlotHold: [networkFailure, "create-hold-slot-not-found"],
      },
    });
    server.use(...scenario.handlers);

    await expect(
      fetch("/api/v1/slot-holds", { method: "POST" }),
    ).rejects.toThrow();

    const api = createApiClient(createHttpClient({ baseUrl: "" }));
    await expect(
      api.reservation.createHold(customerId, "hold-failing", {
        slotId,
        orderId: "order-failing",
      }),
    ).rejects.toMatchObject({
      kind: "problem",
      problem: { code: "SLOT_NOT_FOUND" },
    });
  });

  describe("idempotencia con la misma clave", () => {
    const post = (key: string, orderId: string, slot = slotId) =>
      fetch("/api/v1/slot-holds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Customer-Id": customerId,
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ slotId: slot, orderId }),
      });

    it("modela 'en curso' y luego éxito con la misma clave sin fijar lo transitorio", async () => {
      const scenario = createReservationScenario({
        capacityBySlot: { [slotId]: 1 },
        responses: { createSlotHold: ["create-hold-idempotency-progress"] },
      });
      server.use(...scenario.handlers);

      const first = await post("key-a", "order-1");
      const second = await post("key-a", "order-1");
      const third = await post("key-a", "order-1");

      expect(first.status).toBe(409);
      expect(second.status).toBe(201);
      expect(await third.json()).toEqual(await second.json());
      expect((await post("key-b", "order-2")).status).toBe(409);
    });

    it("conserva el efecto cuando la respuesta se pierde y lo repite con la misma clave", async () => {
      const scenario = createReservationScenario({
        capacityBySlot: { [slotId]: 1 },
        responses: { createSlotHold: [lostResponse] },
      });
      server.use(...scenario.handlers);

      await expect(post("key-a", "order-1")).rejects.toThrow();
      const retried = await post("key-a", "order-1");
      const other = await post("key-b", "order-2");

      expect(retried.status).toBe(201);
      expect(other.status).toBe(409);
      expect(((await other.json()) as { code: string }).code).toBe("SLOT_FULL");
    });

    it("no consume el guion en repeticiones y fija los rechazos", async () => {
      const scenario = createReservationScenario({
        responses: {
          createSlotHold: ["create-hold-slot-not-found", "create-hold-cutoff"],
        },
      });
      server.use(...scenario.handlers);

      const first = await post("key-a", "order-1");
      const repeated = await post("key-a", "order-1");
      const next = await post("key-b", "order-2");

      expect(((await first.json()) as { code: string }).code).toBe(
        "SLOT_NOT_FOUND",
      );
      expect(((await repeated.json()) as { code: string }).code).toBe(
        "SLOT_NOT_FOUND",
      );
      expect(((await next.json()) as { code: string }).code).toBe(
        "SLOT_CUTOFF_PASSED",
      );
    });
  });

  it("refleja estado en getHold, confirma y expone la reserva", async () => {
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    const api = createApiClient(createHttpClient({ baseUrl: "" }));

    const hold = await api.reservation.createHold(customerId, "k-1", {
      slotId,
      orderId: "order-1",
    });
    const booking = await api.reservation.confirmHold(
      customerId,
      hold.holdId,
      "k-2",
    );

    expect(
      (await api.reservation.getHold(customerId, hold.holdId)).status,
    ).toBe("CONFIRMED");
    expect(
      await api.reservation.getReservation(customerId, booking.reservationId),
    ).toMatchObject({ holdId: hold.holdId, orderId: "order-1" });
    await expect(
      api.reservation.createHold(customerId, "k-3", {
        slotId,
        orderId: "order-1",
      }),
    ).rejects.toMatchObject({
      problem: { code: "ORDER_ALREADY_RESERVED" },
    });
    await expect(
      api.reservation.getHold("otro-cliente", hold.holdId),
    ).rejects.toMatchObject({ problem: { code: "HOLD_NOT_FOUND" } });
  });
});
