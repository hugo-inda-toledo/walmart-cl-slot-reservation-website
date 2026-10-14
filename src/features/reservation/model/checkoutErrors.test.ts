import { describe, expect, it } from "vitest";

import { parseApiError } from "@/api/http/apiError";

import { toCheckoutOutcome } from "./checkoutErrors";

const headers = new Headers();
const intent = {
  slotId: "slot-1",
  idempotencyKey: "hold-key",
  activeHoldRetried: false,
};

function problem(body: Record<string, unknown>) {
  return parseApiError(409, { title: "Problema", ...body }, headers);
}

describe("toCheckoutOutcome", () => {
  it.each([
    [
      "SLOT_FULL",
      "hold",
      { code: "SLOT_FULL", slotId: "slot-1", alternatives: [] },
      {
        type: "notice",
        notice: { kind: "slotFull", alternatives: [] },
        backToSelection: true,
        invalidateCatalog: true,
        retryable: false,
      },
    ],
    [
      "SLOT_CUTOFF_PASSED",
      "hold",
      { code: "SLOT_CUTOFF_PASSED" },
      {
        type: "notice",
        notice: { kind: "slotClosed" },
        backToSelection: true,
        invalidateCatalog: true,
        retryable: false,
      },
    ],
    [
      "SLOT_NO_SERVICE",
      "hold",
      { code: "SLOT_NO_SERVICE" },
      {
        type: "notice",
        notice: { kind: "slotClosed" },
        backToSelection: true,
        invalidateCatalog: true,
        retryable: false,
      },
    ],
    [
      "SLOT_NOT_FOUND",
      "hold",
      { code: "SLOT_NOT_FOUND" },
      {
        type: "notice",
        notice: { kind: "slotGone" },
        backToSelection: true,
        invalidateCatalog: true,
        retryable: false,
      },
    ],
    [
      "ACTIVE_HOLD_EXISTS",
      "hold",
      { code: "ACTIVE_HOLD_EXISTS", holdId: "other-hold" },
      { type: "releaseAndRetryHold", holdId: "other-hold" },
    ],
    [
      "ORDER_ALREADY_RESERVED",
      "hold",
      { code: "ORDER_ALREADY_RESERVED", reservationId: "reservation-1" },
      { type: "loadReservation", reservationId: "reservation-1" },
    ],
    [
      "HOLD_EXPIRED",
      "confirm",
      { code: "HOLD_EXPIRED", holdId: "hold-1" },
      {
        type: "notice",
        notice: { kind: "holdExpired" },
        backToSelection: true,
        invalidateCatalog: true,
        retryable: false,
      },
    ],
    [
      "HOLD_NOT_ACTIVE with reservation",
      "confirm",
      {
        code: "HOLD_NOT_ACTIVE",
        holdId: "hold-1",
        holdStatus: "CONFIRMED",
        reservationId: "reservation-1",
      },
      { type: "loadReservation", reservationId: "reservation-1" },
    ],
    [
      "HOLD_NOT_ACTIVE without reservation",
      "confirm",
      { code: "HOLD_NOT_ACTIVE", holdId: "hold-1", holdStatus: "EXPIRED" },
      {
        type: "notice",
        notice: { kind: "holdInactive" },
        backToSelection: true,
        invalidateCatalog: true,
        retryable: false,
      },
    ],
    [
      "HOLD_NOT_FOUND",
      "confirm",
      { code: "HOLD_NOT_FOUND" },
      {
        type: "notice",
        notice: { kind: "holdGone" },
        backToSelection: true,
        invalidateCatalog: true,
        retryable: false,
      },
    ],
  ] as const)("maps %s in %s", (_name, phase, body, expected) => {
    expect(toCheckoutOutcome(problem(body), phase, intent)).toEqual(expected);
  });

  it("retries an active hold only once", () => {
    expect(
      toCheckoutOutcome(
        problem({ code: "ACTIVE_HOLD_EXISTS", holdId: "other-hold" }),
        "hold",
        { ...intent, activeHoldRetried: true },
      ),
    ).toEqual({
      type: "notice",
      notice: { kind: "unexpected" },
      backToSelection: true,
      invalidateCatalog: false,
      retryable: true,
    });
  });

  it.each(["hold", "confirm"] as const)(
    "maps idempotency reuse in %s to a recoverable notice with a new next key",
    (phase) => {
      expect(
        toCheckoutOutcome(
          problem({ code: "IDEMPOTENCY_KEY_REUSED", correlationId: "corr-1" }),
          phase,
          intent,
        ),
      ).toEqual({
        type: "notice",
        notice: { kind: "keyReused", supportCode: "corr-1" },
        backToSelection: phase === "hold",
        invalidateCatalog: false,
        retryable: true,
      });
    },
  );

  it.each([
    problem({ code: "INVALID_CUSTOMER_ID" }),
    problem({
      code: "VALIDATION_ERROR",
      errors: [{ field: "xCustomerId", message: "inválido" }],
    }),
  ])("maps invalid customer identity to a session notice", (error) => {
    expect(toCheckoutOutcome(error, "hold", intent)).toEqual({
      type: "notice",
      notice: { kind: "sessionInvalid" },
      backToSelection: true,
      invalidateCatalog: false,
      retryable: false,
    });
  });

  it.each(["hold", "confirm"] as const)(
    "keeps failed intents retryable after network exhaustion in %s",
    (phase) => {
      expect(
        toCheckoutOutcome(
          { kind: "network", reason: "offline" },
          phase,
          intent,
        ),
      ).toEqual({
        type: "notice",
        notice: { kind: "connection" },
        backToSelection: phase === "hold",
        invalidateCatalog: false,
        retryable: true,
      });
    },
  );

  it.each([
    problem({
      code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      retryAfterSeconds: 3,
      correlationId: "corr-1",
    }),
    problem({ code: "CORS_REJECTED", correlationId: "corr-1" }),
    problem({ code: "REGION_NOT_FOUND", correlationId: "corr-1" }),
    problem({ code: "RESOURCE_NOT_FOUND", correlationId: "corr-1" }),
    problem({ code: "MALFORMED_REQUEST", correlationId: "corr-1" }),
    problem({ code: "NOT_ACCEPTABLE", correlationId: "corr-1" }),
    {
      kind: "unknownProblem",
      problem: {
        status: 500,
        code: "NEW_ERROR",
        title: "Problema",
        correlationId: "corr-1",
        fieldErrors: [],
      },
    } as const,
    {
      kind: "unexpectedResponse",
      status: 502,
      correlationId: "corr-1",
    } as const,
  ])(
    "maps unknown, malformed and exhausted errors to a retryable generic notice",
    (error) => {
      expect(toCheckoutOutcome(error, "confirm", intent)).toEqual({
        type: "notice",
        notice: { kind: "unexpected", supportCode: "corr-1" },
        backToSelection: false,
        invalidateCatalog: false,
        retryable: true,
      });
    },
  );
});
