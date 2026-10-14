import { HttpResponse, http, type HttpHandler } from "msw";

import { responseFromFixture } from "./handlers";
import { FIXTURES, type FixtureEntry } from "./fixtures";

type ReservationOperation =
  | "createSlotHold"
  | "getSlotHold"
  | "releaseSlotHold"
  | "confirmSlotHold"
  | "getReservation";

/**
 * Paso del guion de una operación: nombre de una fixture del registro, caída de
 * red antes de procesar, o caída de red con el efecto ya aplicado (respuesta
 * perdida). Solo las peticiones que no son repetición idempotente consumen guion.
 */
export type ScenarioResponse =
  string | { readonly kind: "network" } | { readonly kind: "lostResponse" };

export const networkFailure = { kind: "network" } as const;
export const lostResponse = { kind: "lostResponse" } as const;

const TRANSIENT_CODES = new Set(["IDEMPOTENCY_REQUEST_IN_PROGRESS"]);

export interface ReservationScenarioOptions {
  readonly capacityBySlot?: Readonly<Record<string, number>>;
  readonly responses?: Partial<
    Readonly<Record<ReservationOperation, readonly ScenarioResponse[]>>
  >;
}

export interface ReservationScenario {
  readonly handlers: readonly HttpHandler[];
  /** Respuestas emitidas, para validarlas con el mismo kit de conformidad. */
  responses(): readonly FixtureEntry[];
}

interface HoldState {
  readonly customerId: string;
  readonly orderId: string;
  readonly slotId: string;
  status: "ACTIVE" | "RELEASED" | "CONFIRMED";
  readonly body: unknown;
}

interface IdempotencyState {
  readonly fingerprint: string;
  readonly fixture: FixtureEntry;
}

export function createReservationScenario(
  options: ReservationScenarioOptions = {},
): ReservationScenario {
  const capacity = new Map(Object.entries(options.capacityBySlot ?? {}));
  const scripted = new Map(
    Object.entries(options.responses ?? {}).map(([operation, responses]) => [
      operation,
      [...responses],
    ]),
  );
  const holds = new Map<string, HoldState>();
  const holdByOrder = new Map<string, string>();
  const idempotency = new Map<string, IdempotencyState>();
  const confirmedOrders = new Set<string>();
  const reservations = new Map<string, unknown>();
  const emitted: FixtureEntry[] = [];
  let nextHold = 1;

  const emit = (fixture: FixtureEntry) => {
    emitted.push(fixture);
    return responseFromFixture(fixture);
  };
  const fixture = (name: string, body?: unknown): FixtureEntry => {
    const source = FIXTURES.find((entry) => entry.name === name);
    if (!source) throw new Error(`No existe fixture ${name}.`);
    return body === undefined ? source : { ...source, body };
  };
  type Step =
    | { readonly kind: "fixture"; readonly fixture: FixtureEntry }
    | { readonly kind: "network" }
    | { readonly kind: "lostResponse" }
    | undefined;
  const nextStep = (operation: ReservationOperation): Step => {
    const item = scripted.get(operation)?.shift();
    if (item === undefined) return undefined;
    if (typeof item === "string")
      return { kind: "fixture", fixture: fixture(item) };
    return item;
  };
  const isTransient = (entry: FixtureEntry) =>
    typeof entry.body === "object" &&
    entry.body !== null &&
    TRANSIENT_CODES.has(String((entry.body as { code?: unknown }).code));
  /**
   * Procesa una operación idempotente: una repetición con la misma clave devuelve
   * la respuesta fijada sin consumir guion ni repetir el efecto; las respuestas
   * transitorias ("en curso") y las caídas previas al procesamiento no se fijan.
   */
  const idempotent = (
    key: string,
    fingerprint: string,
    operation: ReservationOperation,
    compute: () => FixtureEntry,
  ) => {
    const previous = idempotency.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        return emit(fixture("create-hold-idempotency-key-reused"));
      return emit(previous.fixture);
    }
    const step = nextStep(operation);
    if (step?.kind === "network") return HttpResponse.error();
    const result = step?.kind === "fixture" ? step.fixture : compute();
    if (!isTransient(result)) {
      idempotency.set(key, { fingerprint, fixture: result });
    }
    if (step?.kind === "lostResponse") return HttpResponse.error();
    return emit(result);
  };
  const plain = (
    operation: ReservationOperation,
    compute: () => FixtureEntry,
  ) => {
    const step = nextStep(operation);
    if (step?.kind === "network") return HttpResponse.error();
    const result = step?.kind === "fixture" ? step.fixture : compute();
    if (step?.kind === "lostResponse") return HttpResponse.error();
    return emit(result);
  };
  const holdFixture = (holdId: string, orderId: string, slotId: string) => {
    const source = fixture("create-hold-success").body as Record<
      string,
      unknown
    >;
    const sourceSlot = source.slot as Record<string, unknown>;
    return fixture("create-hold-success", {
      ...source,
      holdId,
      orderId,
      slot: { ...sourceSlot, slotId },
    });
  };

  return {
    handlers: [
      http.post("/api/v1/slot-holds", async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          slotId: string;
          orderId: string;
        };
        const customerId = request.headers.get("X-Customer-Id") ?? "";
        const key = request.headers.get("Idempotency-Key") ?? "";
        const fingerprint = JSON.stringify({ customerId, body });
        return idempotent(key, fingerprint, "createSlotHold", () => {
          const existingHoldId = holdByOrder.get(
            `${customerId}:${body.orderId}`,
          );
          if (existingHoldId) {
            return fixture("create-hold-active-exists", {
              ...(fixture("create-hold-active-exists").body as object),
              holdId: existingHoldId,
            });
          }
          if (confirmedOrders.has(`${customerId}:${body.orderId}`)) {
            return fixture("create-hold-order-reserved");
          }
          const remaining = capacity.get(body.slotId);
          if (remaining !== undefined && remaining <= 0) {
            return fixture("create-hold-slot-full", {
              ...(fixture("create-hold-slot-full").body as object),
              slotId: body.slotId,
            });
          }
          if (remaining !== undefined) capacity.set(body.slotId, remaining - 1);
          const holdId = `44444444-4444-4444-8444-${String(nextHold++).padStart(12, "0")}`;
          const created = holdFixture(holdId, body.orderId, body.slotId);
          holds.set(holdId, {
            customerId,
            orderId: body.orderId,
            slotId: body.slotId,
            status: "ACTIVE",
            body: created.body,
          });
          holdByOrder.set(`${customerId}:${body.orderId}`, holdId);
          return created;
        });
      }),
      http.get("/api/v1/slot-holds/:holdId", ({ params, request }) =>
        plain("getSlotHold", () => {
          const hold = holds.get(String(params.holdId));
          if (
            !hold ||
            hold.customerId !== (request.headers.get("X-Customer-Id") ?? "")
          )
            return fixture("get-hold-not-found");
          return fixture("get-hold-success", {
            ...(hold.body as object),
            status: hold.status,
          });
        }),
      ),
      http.delete("/api/v1/slot-holds/:holdId", ({ params }) =>
        plain("releaseSlotHold", () => {
          const hold = holds.get(String(params.holdId));
          if (!hold || hold.status !== "ACTIVE")
            return fixture("release-hold-not-active");
          hold.status = "RELEASED";
          holdByOrder.delete(`${hold.customerId}:${hold.orderId}`);
          const remaining = capacity.get(hold.slotId);
          if (remaining !== undefined) capacity.set(hold.slotId, remaining + 1);
          return fixture("release-hold-success");
        }),
      ),
      http.post("/api/v1/slot-holds/:holdId/confirm", ({ params, request }) => {
        const key = request.headers.get("Idempotency-Key") ?? "";
        const fingerprint = JSON.stringify({
          holdId: params.holdId,
          customerId: request.headers.get("X-Customer-Id"),
        });
        return idempotent(key, fingerprint, "confirmSlotHold", () => {
          const hold = holds.get(String(params.holdId));
          if (!hold || hold.status !== "ACTIVE")
            return fixture("confirm-hold-not-active");
          hold.status = "CONFIRMED";
          holdByOrder.delete(`${hold.customerId}:${hold.orderId}`);
          confirmedOrders.add(`${hold.customerId}:${hold.orderId}`);
          const source = fixture("confirm-hold-success").body as Record<
            string,
            unknown
          >;
          const confirmed = fixture("confirm-hold-success", {
            ...source,
            holdId: params.holdId,
            orderId: hold.orderId,
            slot: (hold.body as Record<string, unknown>).slot,
          });
          reservations.set(String(source.reservationId), confirmed.body);
          return confirmed;
        });
      }),
      http.get("/api/v1/reservations/:reservationId", ({ params }) =>
        plain("getReservation", () => {
          const reservation = reservations.get(String(params.reservationId));
          return reservation === undefined
            ? fixture("get-reservation-not-found")
            : fixture("get-reservation-success", reservation);
        }),
      ),
    ],
    responses: () => emitted,
  };
}
