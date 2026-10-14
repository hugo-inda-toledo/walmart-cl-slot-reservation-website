import { describe, expect, it } from "vitest";

import {
  checkoutReducer,
  type CheckoutEvent,
  type CheckoutState,
  type HoldIntent,
} from "./checkoutMachine";

const hold = {
  holdId: "hold-1",
  orderId: "order-1",
  status: "ACTIVE" as const,
  createdAt: "2026-10-12T10:00:00Z",
  expiresAt: "2026-10-12T10:10:00Z",
  slot: {
    slotId: "slot-1",
    zoneId: "zone-1",
    deliveryDate: "2026-10-13",
    start: "2026-10-13T16:00:00-03:00",
    end: "2026-10-13T18:00:00-03:00",
    price: 2990,
    timeZone: "America/Santiago" as const,
  },
};
const reservation = {
  reservationId: "reservation-1",
  holdId: hold.holdId,
  orderId: hold.orderId,
  status: "CONFIRMED" as const,
  confirmedAt: "2026-10-12T10:01:00Z",
  slot: hold.slot,
};
const holdIntent: HoldIntent = {
  slotId: hold.slot.slotId,
  idempotencyKey: "hold-key",
  activeHoldRetried: false,
};
const confirmIntent = { holdId: hold.holdId, idempotencyKey: "confirm-key" };
const selecting: CheckoutState = {
  step: "selecting",
  notice: null,
  failedIntent: null,
};

describe("checkoutReducer", () => {
  it.each<readonly [CheckoutState, CheckoutEvent, CheckoutState]>([
    [{ step: "restoring" }, { type: "RESTORED", to: "selecting" }, selecting],
    [
      { step: "restoring" },
      { type: "RESTORED_HOLD", hold },
      { step: "held", hold, notice: null, failedIntent: null },
    ],
    [
      { step: "restoring" },
      { type: "RESTORED_RESERVATION", reservation },
      { step: "confirmed", reservation },
    ],
    [
      selecting,
      { type: "HOLD_REQUESTED", intent: holdIntent },
      { step: "holding", intent: holdIntent },
    ],
    [
      { step: "holding", intent: holdIntent },
      { type: "HOLD_SUCCEEDED", hold },
      { step: "held", hold, notice: null, failedIntent: null },
    ],
    [
      { step: "holding", intent: holdIntent },
      { type: "HOLD_FAILED", notice: { kind: "connection" }, retryable: true },
      {
        step: "selecting",
        notice: { kind: "connection" },
        failedIntent: holdIntent,
      },
    ],
    [
      { step: "holding", intent: holdIntent },
      { type: "HOLD_FAILED", notice: { kind: "slotGone" }, retryable: false },
      {
        step: "selecting",
        notice: { kind: "slotGone" },
        failedIntent: null,
      },
    ],
    [
      { step: "held", hold, notice: null, failedIntent: null },
      { type: "CONFIRM_REQUESTED", intent: confirmIntent },
      { step: "confirming", hold, intent: confirmIntent },
    ],
    [
      { step: "confirming", hold, intent: confirmIntent },
      { type: "CONFIRM_SUCCEEDED", reservation },
      { step: "confirmed", reservation },
    ],
    [
      { step: "confirming", hold, intent: confirmIntent },
      {
        type: "CONFIRM_FAILED",
        notice: { kind: "connection" },
        backToSelection: false,
        retryable: true,
      },
      {
        step: "held",
        hold,
        notice: { kind: "connection" },
        failedIntent: confirmIntent,
      },
    ],
    [
      { step: "confirming", hold, intent: confirmIntent },
      {
        type: "CONFIRM_FAILED",
        notice: { kind: "holdExpired" },
        backToSelection: true,
        retryable: false,
      },
      {
        step: "selecting",
        notice: { kind: "holdExpired" },
        failedIntent: null,
      },
    ],
    [
      { step: "held", hold, notice: null, failedIntent: null },
      { type: "RELEASE_REQUESTED", next: "selecting" },
      { step: "releasing", hold, next: "selecting" },
    ],
    [
      { step: "releasing", hold, next: "selecting" },
      { type: "RELEASE_DONE" },
      selecting,
    ],
    [
      { step: "releasing", hold, next: "newCustomer" },
      { type: "RELEASE_DONE" },
      selecting,
    ],
    [
      { step: "held", hold, notice: null, failedIntent: null },
      { type: "COUNTDOWN_ELAPSED" },
      {
        step: "held",
        hold,
        expired: true,
        notice: null,
        failedIntent: null,
      },
    ],
    [{ step: "confirmed", reservation }, { type: "NEW_CHECKOUT" }, selecting],
    [
      {
        step: "held",
        hold,
        notice: { kind: "connection" },
        failedIntent: confirmIntent,
      },
      { type: "NOTICE_DISMISSED" },
      { step: "held", hold, notice: null, failedIntent: confirmIntent },
    ],
  ])("transitions %#", (state, event, expected) => {
    expect(checkoutReducer(state, event)).toEqual(expected);
  });

  it.each<readonly [CheckoutState, CheckoutEvent]>([
    [
      { step: "holding", intent: holdIntent },
      { type: "HOLD_REQUESTED", intent: holdIntent },
    ],
    [
      { step: "confirming", hold, intent: confirmIntent },
      { type: "CONFIRM_REQUESTED", intent: confirmIntent },
    ],
    [
      { step: "releasing", hold, next: "selecting" },
      { type: "RELEASE_REQUESTED", next: "newCustomer" },
    ],
    [selecting, { type: "CONFIRM_SUCCEEDED", reservation }],
    [
      { step: "confirmed", reservation },
      { type: "HOLD_REQUESTED", intent: holdIntent },
    ],
  ])("keeps the same state for invalid or busy events", (state, event) => {
    expect(checkoutReducer(state, event)).toBe(state);
  });
});
