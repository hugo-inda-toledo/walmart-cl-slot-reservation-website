import { describe, expect, it } from "vitest";

import {
  isCustomerIdValidationError,
  parseApiError,
  supportCode,
} from "./apiError";

const headers = (values: Record<string, string> = {}) => new Headers(values);

const baseProblem = {
  status: 409,
  title: "Conflicto",
  code: "SLOT_FULL",
  correlationId: "body-correlation",
};

describe("parseApiError", () => {
  it("maps every known problem code when its required extensions are valid", () => {
    const cases: ReadonlyArray<
      readonly [{ readonly status: number } & Record<string, unknown>, string]
    > = [
      [{ ...baseProblem, slotId: "slot-1", alternatives: [] }, "SLOT_FULL"],
      [
        { ...baseProblem, code: "ACTIVE_HOLD_EXISTS", holdId: "hold-1" },
        "ACTIVE_HOLD_EXISTS",
      ],
      [
        {
          ...baseProblem,
          code: "ORDER_ALREADY_RESERVED",
          reservationId: "reservation-1",
        },
        "ORDER_ALREADY_RESERVED",
      ],
      [
        { ...baseProblem, code: "HOLD_EXPIRED", holdId: "hold-1" },
        "HOLD_EXPIRED",
      ],
      [
        {
          ...baseProblem,
          code: "HOLD_NOT_ACTIVE",
          holdId: "hold-1",
          holdStatus: "ACTIVE",
        },
        "HOLD_NOT_ACTIVE",
      ],
      [
        {
          ...baseProblem,
          code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
          retryAfterSeconds: 3,
        },
        "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      ],
      [
        {
          ...baseProblem,
          code: "DELIVERY_DATE_OUT_OF_RANGE",
          date: "2026-10-12",
          minDate: "2026-10-12",
          maxDate: "2026-10-19",
        },
        "DELIVERY_DATE_OUT_OF_RANGE",
      ],
      [
        {
          ...baseProblem,
          code: "ADDRESS_NOT_COVERED",
          reason: "COMUNA_NOT_SERVED",
        },
        "ADDRESS_NOT_COVERED",
      ],
      ...[
        "SLOT_CUTOFF_PASSED",
        "SLOT_NO_SERVICE",
        "SLOT_NOT_FOUND",
        "HOLD_NOT_FOUND",
        "RESERVATION_NOT_FOUND",
        "IDEMPOTENCY_KEY_REUSED",
        "INVALID_CUSTOMER_ID",
        "VALIDATION_ERROR",
        "UNKNOWN_COMUNA",
        "INCOMPLETE_COORDINATES",
        "INVALID_COORDINATES",
      ].map<
        readonly [{ readonly status: number } & Record<string, unknown>, string]
      >((code) => [{ ...baseProblem, code }, code]),
    ];

    for (const [body, code] of cases) {
      const error = parseApiError(body.status, body, headers());
      expect(error).toMatchObject({ kind: "problem", problem: { code } });
    }
  });

  it("maps foundation errors and uses body retry and correlation values", () => {
    const error = parseApiError(
      400,
      {
        ...baseProblem,
        code: "VALIDATION_ERROR",
        errors: [
          {
            field: "street",
            message: "La calle es obligatoria",
            rejectedValue: "",
          },
        ],
      },
      headers(),
    );

    expect(error).toMatchObject({
      kind: "problem",
      problem: {
        fieldErrors: [
          {
            field: "street",
            message: "La calle es obligatoria",
            rejectedValue: "",
          },
        ],
      },
    });
    expect(supportCode(error)).toBe("body-correlation");
  });

  it("uses Retry-After and X-Correlation-Id when the body does not provide them", () => {
    const error = parseApiError(
      409,
      {
        ...baseProblem,
        code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
        correlationId: undefined,
      },
      headers({ "Retry-After": "7", "X-Correlation-Id": "header-correlation" }),
    );

    expect(error).toMatchObject({
      kind: "problem",
      problem: { retryAfterSeconds: 7 },
    });
    expect(supportCode(error)).toBe("header-correlation");
  });

  it("degrades a missing required extension to an unknown problem", () => {
    expect(
      parseApiError(409, { ...baseProblem, alternatives: [] }, headers()),
    ).toMatchObject({ kind: "unknownProblem", problem: { code: "SLOT_FULL" } });
  });

  it("maps a non-Problem HTML response to unexpectedResponse", () => {
    expect(
      parseApiError(
        502,
        "<html>bad gateway</html>",
        headers({ "X-Correlation-Id": "gateway" }),
      ),
    ).toEqual({
      kind: "unexpectedResponse",
      status: 502,
      correlationId: "gateway",
    });
  });

  it("detects invalid customer identity from direct and validation problems", () => {
    const invalidCustomer = parseApiError(
      400,
      { ...baseProblem, code: "INVALID_CUSTOMER_ID" },
      headers(),
    );
    const validation = parseApiError(
      400,
      {
        ...baseProblem,
        code: "VALIDATION_ERROR",
        errors: [{ field: "xCustomerId", message: "inválido" }],
      },
      headers(),
    );

    expect(isCustomerIdValidationError(invalidCustomer)).toBe(true);
    expect(isCustomerIdValidationError(validation)).toBe(true);
  });
});
