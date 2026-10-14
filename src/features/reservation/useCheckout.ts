import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { useApiClient } from "@/api/ApiClientProvider";
import type { ApiError } from "@/api/http/apiError";
import type { Booking, SlotHold } from "@/api/types/reservation";
import { newIdempotencyKey, newOrderId } from "@/shared/ids/randomIds";

import {
  newCheckoutSession,
  readCheckoutSession,
  writeCheckoutSession,
  type CheckoutSession,
} from "./checkoutSession";
import { toCheckoutOutcome } from "./model/checkoutErrors";
import {
  checkoutReducer,
  type CheckoutState,
  type ConfirmIntent,
  type HoldIntent,
} from "./model/checkoutMachine";

export interface UseCheckoutParams {
  readonly customerId: string;
  readonly onSelectionInvalidated: () => void;
}

export interface CheckoutController {
  readonly state: CheckoutState;
  readonly orderId: string;
  reserve(slotId: string): void;
  retry(): void;
  changeSlot(): void;
  confirm(): void;
  expire(): void;
  startNewCheckout(): void;
  switchCustomer(nextCustomerId: string): Promise<void>;
  dismissNotice(): void;
}

export function useCheckout({
  customerId,
  onSelectionInvalidated,
}: UseCheckoutParams): CheckoutController {
  const api = useApiClient();
  const initial = useRef<CheckoutSession | undefined>(undefined);
  const restoring = useRef<CheckoutSession | null>(null);
  if (initial.current === undefined) {
    const saved = readCheckoutSession();
    initial.current =
      saved?.customerId === customerId ? saved : newCheckoutSession(customerId);
    if (
      saved?.customerId === customerId &&
      (saved.holdId || saved.reservationId)
    )
      restoring.current = saved;
    writeCheckoutSession(initial.current);
  }
  const session = useRef(initial.current);
  const customer = useRef(customerId);
  const [state, dispatch] = useReducer(checkoutReducer, {
    ...(restoring.current === null
      ? { step: "selecting", notice: null, failedIntent: null }
      : { step: "restoring" }),
  } as CheckoutState);
  const [orderId, setOrderId] = useState(session.current.orderId);

  const persist = useCallback((next: CheckoutSession) => {
    session.current = next;
    writeCheckoutSession(next);
  }, []);
  const clearHeldSession = useCallback(() => {
    persist({
      customerId: customer.current,
      orderId: session.current.orderId,
    });
  }, [persist]);
  const invalidate = useCallback(onSelectionInvalidated, [
    onSelectionInvalidated,
  ]);

  const release = useCallback(
    async (customerId: string, hold: SlotHold) => {
      try {
        await api.reservation.releaseHold(customerId, hold.holdId);
      } catch (cause) {
        const error = cause as ApiError;
        if (error.kind === "problem" && error.problem.status === 409) {
          try {
            await api.reservation.getHold(customerId, hold.holdId);
          } catch {
            // The hold is no longer actionable; either result allows checkout to continue.
          }
        }
      }
    },
    [api.reservation],
  );

  const runHold = useCallback(
    async function runHold(intent: HoldIntent) {
      dispatch({ type: "HOLD_REQUESTED", intent });
      try {
        const hold = await api.reservation.createHold(
          customer.current,
          intent.idempotencyKey,
          {
            slotId: intent.slotId,
            orderId: session.current.orderId,
          },
        );
        persist({ ...session.current, holdId: hold.holdId });
        dispatch({ type: "HOLD_SUCCEEDED", hold });
      } catch (cause) {
        const outcome = toCheckoutOutcome(cause as ApiError, "hold", intent);
        if (outcome.type === "releaseAndRetryHold") {
          await release(customer.current, {
            holdId: outcome.holdId,
          } as SlotHold);
          await runHold({
            ...intent,
            idempotencyKey: newIdempotencyKey(),
            activeHoldRetried: true,
          });
          return;
        }
        if (outcome.type === "loadReservation") {
          try {
            const reservation = await api.reservation.getReservation(
              customer.current,
              outcome.reservationId,
            );
            persist({
              ...session.current,
              reservationId: reservation.reservationId,
            });
            dispatch({ type: "HOLD_RESERVATION_LOADED", reservation });
          } catch {
            dispatch({
              type: "HOLD_FAILED",
              notice: { kind: "unexpected" },
              retryable: true,
            });
          }
          return;
        }
        if (outcome.invalidateCatalog) invalidate();
        dispatch({
          type: "HOLD_FAILED",
          notice: outcome.notice,
          retryable: outcome.retryable,
        });
      }
    },
    [api.reservation, invalidate, persist, release],
  );

  const loadConfirmedReservation = useCallback(
    async (
      reservationId: string,
      onSuccess: (reservation: Booking) => void,
    ) => {
      const reservation = await api.reservation.getReservation(
        customer.current,
        reservationId,
      );
      persist({
        customerId: customer.current,
        orderId: session.current.orderId,
        reservationId: reservation.reservationId,
      });
      onSuccess(reservation);
    },
    [api.reservation, persist],
  );

  const runConfirm = useCallback(
    async function runConfirm(intent: ConfirmIntent, hold: SlotHold) {
      dispatch({ type: "CONFIRM_REQUESTED", intent });
      try {
        const reservation = await api.reservation.confirmHold(
          customer.current,
          hold.holdId,
          intent.idempotencyKey,
        );
        persist({
          customerId: customer.current,
          orderId: session.current.orderId,
          reservationId: reservation.reservationId,
        });
        dispatch({ type: "CONFIRM_SUCCEEDED", reservation });
      } catch (cause) {
        const outcome = toCheckoutOutcome(cause as ApiError, "confirm", intent);
        if (outcome.type === "loadReservation") {
          try {
            await loadConfirmedReservation(
              outcome.reservationId,
              (reservation) => {
                dispatch({ type: "CONFIRM_SUCCEEDED", reservation });
              },
            );
          } catch {
            dispatch({
              type: "CONFIRM_FAILED",
              notice: { kind: "unexpected" },
              backToSelection: false,
              retryable: true,
            });
          }
          return;
        }
        if (outcome.type === "notice") {
          if (outcome.backToSelection) clearHeldSession();
          if (outcome.invalidateCatalog) invalidate();
          dispatch({
            type: "CONFIRM_FAILED",
            notice: outcome.notice,
            backToSelection: outcome.backToSelection,
            retryable: outcome.retryable,
          });
        }
      }
    },
    [
      api.reservation,
      clearHeldSession,
      invalidate,
      loadConfirmedReservation,
      persist,
    ],
  );

  const reserve = useCallback(
    (slotId: string) => {
      if (state.step !== "selecting") return;
      void runHold({
        slotId,
        idempotencyKey: newIdempotencyKey(),
        activeHoldRetried: false,
      });
    },
    [runHold, state.step],
  );
  const retry = useCallback(() => {
    if (state.step === "selecting" && state.failedIntent !== null) {
      void runHold({
        ...state.failedIntent,
        idempotencyKey:
          state.notice?.kind === "keyReused"
            ? newIdempotencyKey()
            : state.failedIntent.idempotencyKey,
      });
      return;
    }
    if (state.step === "held" && state.failedIntent !== null)
      void runConfirm(
        {
          ...state.failedIntent,
          idempotencyKey:
            state.notice?.kind === "keyReused"
              ? newIdempotencyKey()
              : state.failedIntent.idempotencyKey,
        },
        state.hold,
      );
  }, [runConfirm, runHold, state]);
  const changeSlot = useCallback(() => {
    if (state.step !== "held") return;
    dispatch({ type: "RELEASE_REQUESTED", next: "selecting" });
    void release(customer.current, state.hold).finally(() => {
      persist({
        customerId: customer.current,
        orderId: session.current.orderId,
      });
      invalidate();
      dispatch({ type: "RELEASE_DONE" });
    });
  }, [invalidate, persist, release, state]);
  const switchCustomer = useCallback(
    async (nextCustomerId: string) => {
      const oldCustomer = customer.current;
      if (state.step === "held") {
        dispatch({ type: "RELEASE_REQUESTED", next: "newCustomer" });
        await release(oldCustomer, state.hold);
      }
      customer.current = nextCustomerId;
      const next = { customerId: nextCustomerId, orderId: newOrderId() };
      persist(next);
      setOrderId(next.orderId);
      if (state.step === "held") dispatch({ type: "RELEASE_DONE" });
      else dispatch({ type: "NEW_CHECKOUT" });
    },
    [persist, release, state],
  );

  useEffect(() => {
    if (customerId !== customer.current) void switchCustomer(customerId);
  }, [customerId, switchCustomer]);

  useEffect(() => {
    const saved = restoring.current;
    if (saved === null) return;
    restoring.current = null;
    const clearHold = () => {
      persist({
        customerId: customer.current,
        orderId: session.current.orderId,
      });
      dispatch({ type: "RESTORED", to: "selecting" });
    };
    if (saved.reservationId !== undefined) {
      void loadConfirmedReservation(saved.reservationId, (reservation) => {
        dispatch({ type: "RESTORED_RESERVATION", reservation });
      }).catch(clearHold);
      return;
    }
    if (saved.holdId === undefined) {
      clearHold();
      return;
    }
    void api.reservation
      .getHold(customer.current, saved.holdId)
      .then((hold) => {
        if (
          hold.status === "ACTIVE" &&
          Date.parse(hold.expiresAt) > api.clock.now()
        ) {
          dispatch({ type: "RESTORED_HOLD", hold });
          return;
        }
        if (hold.status === "CONFIRMED" && hold.reservationId !== undefined) {
          void loadConfirmedReservation(hold.reservationId, (reservation) => {
            dispatch({ type: "RESTORED_RESERVATION", reservation });
          }).catch(clearHold);
          return;
        }
        clearHold();
      })
      .catch(clearHold);
  }, [api.clock, api.reservation, loadConfirmedReservation, persist]);

  const confirm = useCallback(() => {
    if (state.step !== "held" || state.expired) return;
    void runConfirm(
      { holdId: state.hold.holdId, idempotencyKey: newIdempotencyKey() },
      state.hold,
    );
  }, [runConfirm, state]);
  const expire = useCallback(() => {
    if (state.step !== "held") return;
    clearHeldSession();
    invalidate();
    dispatch({ type: "COUNTDOWN_ELAPSED" });
  }, [clearHeldSession, invalidate, state.step]);
  const startNewCheckout = useCallback(() => {
    if (state.step !== "confirmed") return;
    const next = newCheckoutSession(customer.current);
    persist(next);
    setOrderId(next.orderId);
    dispatch({ type: "NEW_CHECKOUT" });
  }, [persist, state.step]);

  return {
    state,
    orderId,
    reserve,
    retry,
    changeSlot,
    confirm,
    expire,
    startNewCheckout,
    switchCustomer,
    dismissNotice: () => {
      dispatch({ type: "NOTICE_DISMISSED" });
    },
  };
}
