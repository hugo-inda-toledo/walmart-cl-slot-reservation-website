export type FixtureContentType =
  "application/json" | "application/problem+json";

export interface FixtureEntry {
  readonly name: string;
  readonly operationId: string;
  readonly status: number;
  readonly contentType: FixtureContentType;
  readonly body?: unknown;
}

const ids = {
  zone: "11111111-1111-4111-8111-111111111111",
  slot: "22222222-2222-4222-8222-222222222222",
  alternative: "33333333-3333-4333-8333-333333333333",
  hold: "44444444-4444-4444-8444-444444444444",
  reservation: "55555555-5555-4555-8555-555555555555",
} as const;
const zone = { id: ids.zone, code: "RM-01", name: "Santiago Centro" };
const comuna = { code: "13101", name: "Santiago" };
const slot = {
  slotId: ids.slot,
  zoneId: ids.zone,
  deliveryDate: "2030-01-15",
  start: "2030-01-15T12:00:00-03:00",
  end: "2030-01-15T14:00:00-03:00",
  price: 2990,
  timeZone: "America/Santiago",
};
const hold = {
  holdId: ids.hold,
  orderId: "order-1",
  status: "ACTIVE",
  createdAt: "2030-01-01T12:00:00Z",
  expiresAt: "2030-01-01T12:10:00Z",
  slot,
};
const booking = {
  reservationId: ids.reservation,
  holdId: ids.hold,
  orderId: "order-1",
  status: "CONFIRMED",
  confirmedAt: "2030-01-01T12:01:00Z",
  slot,
};
const problem = (code: string, status: number, extensions: object = {}) => ({
  type: `https://api.walmart.cl/problems/${code.toLowerCase()}`,
  title: "Solicitud no procesable",
  status,
  code,
  correlationId: "fixture-1",
  ...extensions,
});
const fieldError = (operationId: string) => ({
  name: `${operationId}-validation-error`,
  operationId,
  status: 400,
  contentType: "application/problem+json" as const,
  body: problem("VALIDATION_ERROR", 400, {
    errors: [{ field: "comunaCode", message: "Debe indicar una comuna" }],
  }),
});

export const FIXTURES: readonly FixtureEntry[] = [
  {
    name: "list-regions-success",
    operationId: "listRegions",
    status: 200,
    contentType: "application/json",
    body: [{ code: "13", name: "Región Metropolitana" }],
  },
  {
    name: "list-regions-not-acceptable",
    operationId: "listRegions",
    status: 406,
    contentType: "application/problem+json",
    body: problem("NOT_ACCEPTABLE", 406),
  },
  {
    name: "list-comunas-success",
    operationId: "listComunasByRegion",
    status: 200,
    contentType: "application/json",
    body: [
      {
        ...comuna,
        provinceCode: "131",
        provinceName: "Santiago",
        hasBoundary: true,
      },
    ],
  },
  fieldError("listComunasByRegion"),
  {
    name: "list-comunas-region-not-found",
    operationId: "listComunasByRegion",
    status: 404,
    contentType: "application/problem+json",
    body: problem("REGION_NOT_FOUND", 404, { regionCode: "99" }),
  },
  {
    name: "list-demo-addresses-success",
    operationId: "listDemoAddresses",
    status: 200,
    contentType: "application/json",
    body: [
      {
        id: "santiago-monjitas",
        label: "Monjitas",
        street: "Monjitas",
        number: "500",
        comuna,
        latitude: -33.43,
        longitude: -70.65,
        expected: { covered: true, zoneCode: zone.code, method: "COMUNA_CODE" },
      },
    ],
  },
  {
    name: "resolve-coverage-success",
    operationId: "resolveCoverage",
    status: 200,
    contentType: "application/json",
    body: {
      comuna,
      zone,
      method: "COMUNA_CODE",
      comunaDiffersFromDeclared: false,
    },
  },
  fieldError("resolveCoverage"),
  {
    name: "resolve-coverage-unknown-comuna",
    operationId: "resolveCoverage",
    status: 400,
    contentType: "application/problem+json",
    body: problem("UNKNOWN_COMUNA", 400, { comunaCode: "99999" }),
  },
  {
    name: "resolve-coverage-incomplete-coordinates",
    operationId: "resolveCoverage",
    status: 400,
    contentType: "application/problem+json",
    body: problem("INCOMPLETE_COORDINATES", 400),
  },
  {
    name: "resolve-coverage-invalid-coordinates",
    operationId: "resolveCoverage",
    status: 400,
    contentType: "application/problem+json",
    body: problem("INVALID_COORDINATES", 400),
  },
  ...(
    [
      "EXCLUDED_AREA",
      "OUTSIDE_SERVICE_AREA",
      "COMUNA_NOT_SERVED",
      "ZONE_INACTIVE",
    ] as const
  ).map((reason) => ({
    name: `resolve-coverage-not-covered-${reason.toLowerCase()}`,
    operationId: "resolveCoverage",
    status: 422,
    contentType: "application/problem+json" as const,
    body: problem("ADDRESS_NOT_COVERED", 422, {
      reason,
      comunaCode: comuna.code,
    }),
  })),
  {
    name: "list-dates-success-all-states",
    operationId: "listDeliveryDates",
    status: 200,
    contentType: "application/json",
    body: {
      zone,
      comuna,
      timeZone: "America/Santiago",
      dates: ["AVAILABLE", "SOLD_OUT", "NO_SERVICE"].map((status, index) => ({
        date: `2030-01-${String(15 + index)}`,
        label: "Martes",
        status,
      })),
    },
  },
  fieldError("listDeliveryDates"),
  ...(
    [
      "EXCLUDED_AREA",
      "OUTSIDE_SERVICE_AREA",
      "COMUNA_NOT_SERVED",
      "ZONE_INACTIVE",
    ] as const
  ).map((reason) => ({
    name: `list-dates-not-covered-${reason.toLowerCase()}`,
    operationId: "listDeliveryDates",
    status: 422,
    contentType: "application/problem+json" as const,
    body: problem("ADDRESS_NOT_COVERED", 422, {
      reason,
      comunaCode: comuna.code,
    }),
  })),
  {
    name: "list-slots-success-all-states",
    operationId: "listDeliverySlots",
    status: 200,
    contentType: "application/json",
    body: {
      zone,
      comuna,
      date: "2030-01-15",
      label: "Martes",
      status: "AVAILABLE",
      timeZone: "America/Santiago",
      slots: ["AVAILABLE", "SOLD_OUT", "CUTOFF_PASSED"].map(
        (status, index) => ({
          slotId: `${String(index + 6)}2222222-2222-4222-8222-222222222222`,
          start: `2030-01-15T${String(12 + index * 2)}:00:00-03:00`,
          end: `2030-01-15T${String(14 + index * 2)}:00:00-03:00`,
          price: 2990,
          remainingCapacity: index === 0 ? 1 : 0,
          status,
        }),
      ),
    },
  },
  {
    name: "list-slots-date-out-of-range",
    operationId: "listDeliverySlots",
    status: 400,
    contentType: "application/problem+json",
    body: problem("DELIVERY_DATE_OUT_OF_RANGE", 400, {
      date: "2029-01-01",
      minDate: "2030-01-15",
      maxDate: "2030-01-28",
    }),
  },
  {
    name: "list-slots-not-covered",
    operationId: "listDeliverySlots",
    status: 422,
    contentType: "application/problem+json",
    body: problem("ADDRESS_NOT_COVERED", 422, { reason: "COMUNA_NOT_SERVED" }),
  },
  {
    name: "create-hold-success",
    operationId: "createSlotHold",
    status: 201,
    contentType: "application/json",
    body: hold,
  },
  fieldError("createSlotHold"),
  {
    name: "create-hold-slot-not-found",
    operationId: "createSlotHold",
    status: 404,
    contentType: "application/problem+json",
    body: problem("SLOT_NOT_FOUND", 404, { slotId: ids.slot }),
  },
  {
    name: "create-hold-slot-no-service",
    operationId: "createSlotHold",
    status: 422,
    contentType: "application/problem+json",
    body: problem("SLOT_NO_SERVICE", 422, {
      slotId: ids.slot,
      deliveryDate: "2030-01-15",
    }),
  },
  {
    name: "create-hold-cutoff",
    operationId: "createSlotHold",
    status: 422,
    contentType: "application/problem+json",
    body: problem("SLOT_CUTOFF_PASSED", 422, {
      slotId: ids.slot,
      cutoffAt: "2030-01-15T11:00:00-03:00",
    }),
  },
  {
    name: "create-hold-slot-full",
    operationId: "createSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("SLOT_FULL", 409, {
      slotId: ids.slot,
      alternatives: [
        {
          slotId: ids.alternative,
          deliveryDate: "2030-01-16",
          start: "2030-01-16T12:00:00-03:00",
          end: "2030-01-16T14:00:00-03:00",
          price: 2990,
          remainingCapacity: 2,
        },
      ],
    }),
  },
  {
    name: "create-hold-active-exists",
    operationId: "createSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("ACTIVE_HOLD_EXISTS", 409, { holdId: ids.hold }),
  },
  {
    name: "create-hold-order-reserved",
    operationId: "createSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("ORDER_ALREADY_RESERVED", 409, {
      reservationId: ids.reservation,
    }),
  },
  {
    name: "create-hold-idempotency-progress",
    operationId: "createSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("IDEMPOTENCY_REQUEST_IN_PROGRESS", 409, {
      retryAfterSeconds: 2,
    }),
  },
  {
    name: "create-hold-idempotency-key-reused",
    operationId: "createSlotHold",
    status: 422,
    contentType: "application/problem+json",
    body: problem("IDEMPOTENCY_KEY_REUSED", 422),
  },
  {
    name: "create-hold-invalid-customer",
    operationId: "createSlotHold",
    status: 400,
    contentType: "application/problem+json",
    body: problem("INVALID_CUSTOMER_ID", 400),
  },
  {
    name: "get-hold-success",
    operationId: "getSlotHold",
    status: 200,
    contentType: "application/json",
    body: hold,
  },
  {
    name: "get-hold-not-found",
    operationId: "getSlotHold",
    status: 404,
    contentType: "application/problem+json",
    body: problem("HOLD_NOT_FOUND", 404, { holdId: ids.hold }),
  },
  {
    name: "get-hold-confirmed",
    operationId: "getSlotHold",
    status: 200,
    contentType: "application/json",
    body: { ...hold, status: "CONFIRMED", reservationId: ids.reservation },
  },
  {
    name: "release-hold-success",
    operationId: "releaseSlotHold",
    status: 204,
    contentType: "application/json",
  },
  {
    name: "release-hold-not-active",
    operationId: "releaseSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("HOLD_NOT_ACTIVE", 409, {
      holdId: ids.hold,
      holdStatus: "CONFIRMED",
      reservationId: ids.reservation,
    }),
  },
  {
    name: "confirm-hold-success",
    operationId: "confirmSlotHold",
    status: 201,
    contentType: "application/json",
    body: booking,
  },
  {
    name: "confirm-hold-not-active",
    operationId: "confirmSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("HOLD_NOT_ACTIVE", 409, {
      holdId: ids.hold,
      holdStatus: "RELEASED",
    }),
  },
  {
    name: "confirm-hold-not-active-reservation",
    operationId: "confirmSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("HOLD_NOT_ACTIVE", 409, {
      holdId: ids.hold,
      holdStatus: "CONFIRMED",
      reservationId: ids.reservation,
    }),
  },
  {
    name: "confirm-hold-expired",
    operationId: "confirmSlotHold",
    status: 409,
    contentType: "application/problem+json",
    body: problem("HOLD_EXPIRED", 409, {
      holdId: ids.hold,
      expiresAt: "2030-01-01T12:00:00Z",
    }),
  },
  {
    name: "get-reservation-success",
    operationId: "getReservation",
    status: 200,
    contentType: "application/json",
    body: booking,
  },
  {
    name: "get-reservation-not-found",
    operationId: "getReservation",
    status: 404,
    contentType: "application/problem+json",
    body: problem("RESERVATION_NOT_FOUND", 404, {
      reservationId: ids.reservation,
    }),
  },
  {
    name: "cancel-reservation-success",
    operationId: "cancelReservation",
    status: 200,
    contentType: "application/json",
    body: {
      ...booking,
      status: "CANCELLED",
      cancelledAt: "2030-01-01T12:02:00Z",
    },
  },
  {
    name: "cancel-reservation-closed",
    operationId: "cancelReservation",
    status: 422,
    contentType: "application/problem+json",
    body: problem("RESERVATION_CANCELLATION_CLOSED", 422),
  },
];
