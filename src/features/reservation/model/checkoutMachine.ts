import type {
  AlternativeSlot,
  Booking,
  SlotHold,
} from "@/api/types/reservation";

export interface HoldIntent {
  readonly slotId: string;
  readonly idempotencyKey: string;
  readonly activeHoldRetried: boolean;
}

export interface ConfirmIntent {
  readonly holdId: string;
  readonly idempotencyKey: string;
}

export type CheckoutNotice =
  | {
      readonly kind: "slotFull";
      readonly alternatives: readonly AlternativeSlot[];
    }
  | { readonly kind: "slotClosed" }
  | { readonly kind: "slotGone" }
  | { readonly kind: "holdExpired" }
  | { readonly kind: "holdInactive" }
  | { readonly kind: "holdGone" }
  | { readonly kind: "sessionInvalid" }
  | { readonly kind: "keyReused"; readonly supportCode?: string }
  | { readonly kind: "connection" }
  | { readonly kind: "unexpected"; readonly supportCode?: string };

export type CheckoutState =
  | { readonly step: "restoring" }
  | {
      readonly step: "selecting";
      readonly notice: CheckoutNotice | null;
      readonly failedIntent: HoldIntent | null;
    }
  | { readonly step: "holding"; readonly intent: HoldIntent }
  | {
      readonly step: "held";
      readonly hold: SlotHold;
      readonly expired?: boolean;
      readonly notice: CheckoutNotice | null;
      readonly failedIntent: ConfirmIntent | null;
    }
  | {
      readonly step: "confirming";
      readonly hold: SlotHold;
      readonly intent: ConfirmIntent;
    }
  | {
      readonly step: "releasing";
      readonly hold: SlotHold;
      readonly next: "selecting" | "newCustomer";
    }
  | { readonly step: "confirmed"; readonly reservation: Booking };

export type CheckoutEvent =
  | { readonly type: "RESTORED"; readonly to: "selecting" }
  | { readonly type: "RESTORED_HOLD"; readonly hold: SlotHold }
  | { readonly type: "RESTORED_RESERVATION"; readonly reservation: Booking }
  | { readonly type: "HOLD_REQUESTED"; readonly intent: HoldIntent }
  | { readonly type: "HOLD_SUCCEEDED"; readonly hold: SlotHold }
  | { readonly type: "HOLD_RESERVATION_LOADED"; readonly reservation: Booking }
  | {
      readonly type: "HOLD_FAILED";
      readonly notice: CheckoutNotice;
      readonly retryable: boolean;
    }
  | { readonly type: "CONFIRM_REQUESTED"; readonly intent: ConfirmIntent }
  | { readonly type: "CONFIRM_SUCCEEDED"; readonly reservation: Booking }
  | {
      readonly type: "CONFIRM_FAILED";
      readonly notice: CheckoutNotice;
      readonly backToSelection: boolean;
      readonly retryable: boolean;
    }
  | {
      readonly type: "RELEASE_REQUESTED";
      readonly next: "selecting" | "newCustomer";
    }
  | { readonly type: "RELEASE_DONE" }
  | { readonly type: "COUNTDOWN_ELAPSED" }
  | { readonly type: "NEW_CHECKOUT" }
  | { readonly type: "NOTICE_DISMISSED" };

export function checkoutReducer(
  state: CheckoutState,
  event: CheckoutEvent,
): CheckoutState {
  switch (state.step) {
    case "restoring":
      if (event.type === "RESTORED") return selecting();
      if (event.type === "RESTORED_HOLD") return held(event.hold);
      if (event.type === "RESTORED_RESERVATION")
        return { step: "confirmed", reservation: event.reservation };
      return state;
    case "selecting":
      if (event.type === "HOLD_REQUESTED")
        return { step: "holding", intent: event.intent };
      if (event.type === "NOTICE_DISMISSED") return { ...state, notice: null };
      return state;
    case "holding":
      if (event.type === "HOLD_SUCCEEDED") return held(event.hold);
      if (event.type === "HOLD_RESERVATION_LOADED")
        return { step: "confirmed", reservation: event.reservation };
      if (event.type === "HOLD_FAILED")
        return {
          step: "selecting",
          notice: event.notice,
          failedIntent: event.retryable ? state.intent : null,
        };
      return state;
    case "held":
      if (event.type === "CONFIRM_REQUESTED" && !state.expired)
        return { step: "confirming", hold: state.hold, intent: event.intent };
      if (event.type === "RELEASE_REQUESTED")
        return { step: "releasing", hold: state.hold, next: event.next };
      if (event.type === "COUNTDOWN_ELAPSED")
        return { ...state, expired: true, notice: null, failedIntent: null };
      if (event.type === "NOTICE_DISMISSED") return { ...state, notice: null };
      return state;
    case "confirming":
      if (event.type === "CONFIRM_SUCCEEDED")
        return { step: "confirmed", reservation: event.reservation };
      if (event.type === "CONFIRM_FAILED") {
        if (event.backToSelection) return selecting(event.notice);
        return {
          step: "held",
          hold: state.hold,
          notice: event.notice,
          failedIntent: event.retryable ? state.intent : null,
        };
      }
      return state;
    case "releasing":
      return event.type === "RELEASE_DONE" ? selecting() : state;
    case "confirmed":
      return event.type === "NEW_CHECKOUT" ? selecting() : state;
  }
}

function selecting(notice: CheckoutNotice | null = null): CheckoutState {
  return { step: "selecting", notice, failedIntent: null };
}

function held(hold: SlotHold): CheckoutState {
  return { step: "held", hold, notice: null, failedIntent: null };
}
