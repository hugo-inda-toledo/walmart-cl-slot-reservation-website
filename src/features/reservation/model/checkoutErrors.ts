import {
  isCustomerIdValidationError,
  supportCode,
  type ApiError,
} from "@/api/http/apiError";

import type {
  ConfirmIntent,
  CheckoutNotice,
  HoldIntent,
} from "./checkoutMachine";

export type CheckoutOutcome =
  | {
      readonly type: "notice";
      readonly notice: CheckoutNotice;
      readonly backToSelection: boolean;
      readonly invalidateCatalog: boolean;
      readonly retryable: boolean;
    }
  | { readonly type: "releaseAndRetryHold"; readonly holdId: string }
  | { readonly type: "loadReservation"; readonly reservationId: string };

export function toCheckoutOutcome(
  error: ApiError,
  phase: "hold" | "confirm",
  intent?: HoldIntent | ConfirmIntent,
): CheckoutOutcome {
  if (isCustomerIdValidationError(error))
    return noticeOutcome("sessionInvalid", phase, false, false);
  if (error.kind === "network")
    return noticeOutcome("connection", phase, false, true);
  if (error.kind !== "problem") return unexpectedOutcome(error, phase);

  const { code } = error.problem;
  if (code === "IDEMPOTENCY_KEY_REUSED")
    return noticeOutcome(
      keyReusedNotice(supportCode(error)),
      phase,
      false,
      true,
    );
  if (code === "IDEMPOTENCY_REQUEST_IN_PROGRESS")
    return unexpectedOutcome(error, phase);

  if (phase === "hold") {
    if (code === "SLOT_FULL")
      return noticeOutcome(
        { kind: "slotFull", alternatives: error.problem.alternatives },
        phase,
        true,
        false,
      );
    if (code === "SLOT_CUTOFF_PASSED" || code === "SLOT_NO_SERVICE")
      return noticeOutcome("slotClosed", phase, true, false);
    if (code === "SLOT_NOT_FOUND")
      return noticeOutcome("slotGone", phase, true, false);
    if (code === "ACTIVE_HOLD_EXISTS") {
      if (isHoldIntent(intent) && !intent.activeHoldRetried)
        return { type: "releaseAndRetryHold", holdId: error.problem.holdId };
      return unexpectedOutcome(error, phase);
    }
    if (code === "ORDER_ALREADY_RESERVED")
      return {
        type: "loadReservation",
        reservationId: error.problem.reservationId,
      };
  }

  if (phase === "confirm") {
    if (code === "HOLD_EXPIRED")
      return noticeOutcome("holdExpired", phase, true, false);
    if (code === "HOLD_NOT_ACTIVE")
      return error.problem.reservationId === undefined
        ? noticeOutcome("holdInactive", phase, true, false)
        : {
            type: "loadReservation",
            reservationId: error.problem.reservationId,
          };
    if (code === "HOLD_NOT_FOUND")
      return noticeOutcome("holdGone", phase, true, false);
  }

  return unexpectedOutcome(error, phase);
}

function isHoldIntent(
  intent: HoldIntent | ConfirmIntent | undefined,
): intent is HoldIntent {
  return intent !== undefined && "activeHoldRetried" in intent;
}

function noticeOutcome(
  notice: CheckoutNotice | CheckoutNotice["kind"],
  phase: "hold" | "confirm",
  invalidateCatalog: boolean,
  retryable: boolean,
): CheckoutOutcome {
  return {
    type: "notice",
    notice:
      typeof notice === "string"
        ? ({ kind: notice } as CheckoutNotice)
        : notice,
    backToSelection: phase === "hold" || invalidateCatalog,
    invalidateCatalog,
    retryable,
  };
}

function unexpectedOutcome(
  error: ApiError,
  phase: "hold" | "confirm",
): CheckoutOutcome {
  return noticeOutcome(
    unexpectedNotice(supportCode(error)),
    phase,
    false,
    true,
  );
}

function keyReusedNotice(code: string | undefined): CheckoutNotice {
  return code === undefined
    ? { kind: "keyReused" }
    : { kind: "keyReused", supportCode: code };
}

function unexpectedNotice(code: string | undefined): CheckoutNotice {
  return code === undefined
    ? { kind: "unexpected" }
    : { kind: "unexpected", supportCode: code };
}
