import type { CatalogNotCoveredReason } from "../types/catalog";
import type { AlternativeSlot, HoldStatus } from "../types/reservation";
import type { FieldError } from "../types/problem";

export interface ProblemBase {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail?: string;
  readonly correlationId?: string;
  readonly fieldErrors: readonly FieldError[];
}

type BasicProblemCode =
  | "SLOT_CUTOFF_PASSED"
  | "SLOT_NO_SERVICE"
  | "SLOT_NOT_FOUND"
  | "HOLD_NOT_FOUND"
  | "RESERVATION_NOT_FOUND"
  | "IDEMPOTENCY_KEY_REUSED"
  | "INVALID_CUSTOMER_ID"
  | "VALIDATION_ERROR"
  | "UNKNOWN_COMUNA"
  | "INCOMPLETE_COORDINATES"
  | "INVALID_COORDINATES";

export type KnownProblem =
  | (ProblemBase & {
      readonly code: "SLOT_FULL";
      readonly slotId: string;
      readonly alternatives: readonly AlternativeSlot[];
    })
  | (ProblemBase & {
      readonly code: "ACTIVE_HOLD_EXISTS";
      readonly holdId: string;
    })
  | (ProblemBase & {
      readonly code: "ORDER_ALREADY_RESERVED";
      readonly reservationId: string;
    })
  | (ProblemBase & { readonly code: "HOLD_EXPIRED"; readonly holdId: string })
  | (ProblemBase & {
      readonly code: "HOLD_NOT_ACTIVE";
      readonly holdId: string;
      readonly holdStatus: HoldStatus;
      readonly reservationId?: string;
    })
  | (ProblemBase & {
      readonly code: "IDEMPOTENCY_REQUEST_IN_PROGRESS";
      readonly retryAfterSeconds: number;
    })
  | (ProblemBase & {
      readonly code: "DELIVERY_DATE_OUT_OF_RANGE";
      readonly date: string;
      readonly minDate: string;
      readonly maxDate: string;
    })
  | (ProblemBase & {
      readonly code: "ADDRESS_NOT_COVERED";
      readonly reason: CatalogNotCoveredReason;
      readonly comunaCode?: string;
    })
  | (ProblemBase & { readonly code: BasicProblemCode });

export type ApiError =
  | { readonly kind: "problem"; readonly problem: KnownProblem }
  | { readonly kind: "unknownProblem"; readonly problem: ProblemBase }
  | {
      readonly kind: "network";
      readonly reason: "offline" | "timeout" | "aborted";
    }
  | {
      readonly kind: "unexpectedResponse";
      readonly status: number;
      readonly correlationId?: string;
    };

type UnknownRecord = Record<string, unknown>;

const holdStatuses = new Set<HoldStatus>([
  "ACTIVE",
  "CONFIRMED",
  "RELEASED",
  "EXPIRED",
]);
const notCoveredReasons = new Set<CatalogNotCoveredReason>([
  "EXCLUDED_AREA",
  "OUTSIDE_SERVICE_AREA",
  "COMUNA_NOT_SERVED",
  "ZONE_INACTIVE",
]);
const basicCodes = new Set<BasicProblemCode>([
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
]);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringAt(body: UnknownRecord, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

function fieldErrors(body: UnknownRecord): readonly FieldError[] {
  const errors = body.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .filter(
      (error): error is FieldError =>
        isRecord(error) &&
        typeof error.field === "string" &&
        typeof error.message === "string",
    )
    .map((error) => ({
      field: error.field,
      message: error.message,
      ...(error.rejectedValue === undefined
        ? {}
        : { rejectedValue: error.rejectedValue }),
    }));
}

function problemBase(
  status: number,
  body: UnknownRecord,
): ProblemBase | undefined {
  const code = stringAt(body, "code");
  const title = stringAt(body, "title");
  if (code === undefined || title === undefined) return undefined;
  return {
    status,
    code,
    title,
    ...(stringAt(body, "detail") === undefined
      ? {}
      : { detail: stringAt(body, "detail") }),
    ...(stringAt(body, "correlationId") === undefined
      ? {}
      : { correlationId: stringAt(body, "correlationId") }),
    fieldErrors: fieldErrors(body),
  };
}

function knownProblem(
  base: ProblemBase,
  body: UnknownRecord,
  headers: Headers,
): KnownProblem | undefined {
  const code = base.code;
  if (basicCodes.has(code as BasicProblemCode))
    return { ...base, code: code as BasicProblemCode };
  const holdId = stringAt(body, "holdId");
  const reservationId = stringAt(body, "reservationId");
  const slotId = stringAt(body, "slotId");
  const date = stringAt(body, "date");
  const minDate = stringAt(body, "minDate");
  const maxDate = stringAt(body, "maxDate");
  if (
    code === "SLOT_FULL" &&
    slotId !== undefined &&
    Array.isArray(body.alternatives) &&
    body.alternatives.every(isAlternativeSlot)
  )
    return {
      ...base,
      code,
      slotId,
      alternatives: body.alternatives,
    };
  if (code === "ACTIVE_HOLD_EXISTS" && holdId !== undefined)
    return { ...base, code, holdId };
  if (code === "ORDER_ALREADY_RESERVED" && reservationId !== undefined)
    return { ...base, code, reservationId };
  if (code === "HOLD_EXPIRED" && holdId !== undefined)
    return { ...base, code, holdId };
  if (
    code === "HOLD_NOT_ACTIVE" &&
    holdId !== undefined &&
    typeof body.holdStatus === "string" &&
    holdStatuses.has(body.holdStatus as HoldStatus)
  )
    return {
      ...base,
      code,
      holdId,
      holdStatus: body.holdStatus as HoldStatus,
      ...(reservationId === undefined ? {} : { reservationId }),
    };
  if (code === "IDEMPOTENCY_REQUEST_IN_PROGRESS") {
    const retryAfterSeconds =
      typeof body.retryAfterSeconds === "number"
        ? body.retryAfterSeconds
        : Number(headers.get("Retry-After"));
    return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? { ...base, code, retryAfterSeconds }
      : undefined;
  }
  if (
    code === "DELIVERY_DATE_OUT_OF_RANGE" &&
    date !== undefined &&
    minDate !== undefined &&
    maxDate !== undefined
  )
    return { ...base, code, date, minDate, maxDate };
  const comunaCode = stringAt(body, "comunaCode");
  if (
    code === "ADDRESS_NOT_COVERED" &&
    typeof body.reason === "string" &&
    notCoveredReasons.has(body.reason as CatalogNotCoveredReason)
  )
    return {
      ...base,
      code,
      reason: body.reason as CatalogNotCoveredReason,
      ...(comunaCode === undefined ? {} : { comunaCode }),
    };
  return undefined;
}

export function parseApiError(
  status: number,
  body: unknown,
  headers: Headers,
): ApiError {
  const correlationId = headers.get("X-Correlation-Id") ?? undefined;
  if (!isRecord(body))
    return {
      kind: "unexpectedResponse",
      status,
      ...(correlationId === undefined ? {} : { correlationId }),
    };
  const parsedBase = problemBase(status, body);
  if (parsedBase === undefined)
    return {
      kind: "unexpectedResponse",
      status,
      ...(correlationId === undefined ? {} : { correlationId }),
    };
  const base =
    parsedBase.correlationId === undefined && correlationId !== undefined
      ? { ...parsedBase, correlationId }
      : parsedBase;
  const known = knownProblem(base, body, headers);
  return known === undefined
    ? { kind: "unknownProblem", problem: base }
    : { kind: "problem", problem: known };
}

export function isCustomerIdValidationError(error: ApiError): boolean {
  if (error.kind !== "problem") return false;
  return (
    error.problem.code === "INVALID_CUSTOMER_ID" ||
    (error.problem.code === "VALIDATION_ERROR" &&
      error.problem.fieldErrors.some(
        ({ field }) => field === "X-Customer-Id" || field === "xCustomerId",
      ))
  );
}

export function supportCode(error: ApiError): string | undefined {
  if (error.kind === "problem" || error.kind === "unknownProblem")
    return error.problem.correlationId;
  return error.kind === "unexpectedResponse" ? error.correlationId : undefined;
}

function isAlternativeSlot(value: unknown): value is AlternativeSlot {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    ["slotId", "deliveryDate", "start", "end"].every(
      (key) => typeof candidate[key] === "string",
    ) &&
    Number.isInteger(candidate.price) &&
    Number.isInteger(candidate.remainingCapacity)
  );
}
