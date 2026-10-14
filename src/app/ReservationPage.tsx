/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/unbound-method */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "@/api/ApiClientProvider";
import type { ApiError, KnownProblem } from "@/api/http/apiError";
import { queryKeys } from "@/api/queryKeys";
import {
  AddressCard,
  AddressPicker,
  NotCoveredState,
} from "@/features/address/AddressComponents";
import { useAddressSelection } from "@/features/address/useAddressSelection";
import type { DemoCustomer } from "@/features/customer/CustomerSelector";
import { DateStrip } from "@/features/delivery-dates/DateStrip";
import { useDateSelection } from "@/features/delivery-dates/useDateSelection";
import {
  CheckoutNoticeMessage,
  HoldConfirmation,
  ReservationSuccess,
  SlotFullNotice,
} from "@/features/reservation/CheckoutComponents";
import { useCheckout } from "@/features/reservation/useCheckout";
import { SlotList } from "@/features/slots/SlotList";
import { useSlotSelection } from "@/features/slots/useSlotSelection";
import {
  Button,
  Dialog,
  Spinner,
  StatusMessage,
  useAnnounce,
} from "@/shared/ui";

function isNotCovered(error: ApiError | null): error is {
  readonly kind: "problem";
  readonly problem: Extract<
    KnownProblem,
    { readonly code: "ADDRESS_NOT_COVERED" }
  >;
} {
  return (
    error?.kind === "problem" && error.problem.code === "ADDRESS_NOT_COVERED"
  );
}

export function ReservationPage({
  customer,
  onCustomerSelectionBlockedChange,
}: {
  readonly customer: DemoCustomer;
  readonly onCustomerSelectionBlockedChange: (blocked: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const api = useApiClient();
  const announce = useAnnounce();
  const address = useAddressSelection();
  const covered =
    address.status.kind === "covered" ? address.status.address : null;
  const dates = useDateSelection(covered);
  const slots = useSlotSelection(dates.selectedDate, covered);
  const [pickerOpen, setPickerOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef<string | null>(null);
  const previousCustomerId = useRef(customer.id);
  const checkout = useCheckout({
    customerId: customer.id,
    onSelectionInvalidated: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
      slots.clear();
    },
  });
  const checkoutNotice =
    "notice" in checkout.state ? checkout.state.notice : null;

  useEffect(() => {
    if (previousCustomerId.current !== customer.id) {
      previousCustomerId.current = customer.id;
      slots.clear();
    }
  }, [customer.id, slots]);

  useEffect(() => {
    onCustomerSelectionBlockedChange(
      checkout.state.step === "holding" || checkout.state.step === "confirming",
    );
  }, [checkout.state.step, onCustomerSelectionBlockedChange]);

  useEffect(() => {
    if (isNotCovered(dates.error))
      address.markNotCovered(dates.error.problem.reason);
    if (isNotCovered(slots.error))
      address.markNotCovered(slots.error.problem.reason);
    if (
      slots.error?.kind === "problem" &&
      slots.error.problem.code === "DELIVERY_DATE_OUT_OF_RANGE"
    )
      dates.handleOutOfRange(slots.error.problem);
  }, [address, dates, slots.error]);

  useEffect(() => {
    const step = checkout.state.step;
    if (step !== previousStep.current) {
      const previous = previousStep.current;
      previousStep.current = step;
      // No se mueve el foco al cargar la página (ni al terminar de restaurar una
      // reserva): solo cuando el usuario cambia de paso.
      const userChangedStep = previous !== null && previous !== "restoring";
      if (
        userChangedStep &&
        step !== "restoring" &&
        step !== "held" &&
        step !== "confirming"
      ) {
        headingRef.current?.focus();
      }
      if (step !== "restoring") {
        announce(
          step === "held"
            ? "Confirma tu horario de despacho"
            : step === "confirmed"
              ? "Tu horario está reservado"
              : "Selecciona un horario de despacho",
        );
      }
    }
  }, [announce, checkout.state.step]);

  useEffect(() => {
    if (checkoutNotice) {
      noticeRef.current?.focus();
      announce("Se produjo un aviso en la reserva", "assertive");
    }
  }, [announce, checkoutNotice]);

  const addressText = covered
    ? `${covered.street} ${covered.number}, ${covered.resolvedComuna.name}`
    : "";
  const canReserve =
    covered !== null &&
    slots.selectedSlot?.status === "AVAILABLE" &&
    checkout.state.step === "selecting";

  if (checkout.state.step === "restoring")
    return (
      <main
        id="main-content"
        className="reservation-page reservation-page--loading"
      >
        <Spinner label="Recuperando tu reserva…" />
      </main>
    );
  if (checkout.state.step === "held" || checkout.state.step === "confirming") {
    const holding =
      checkout.state.step === "held"
        ? checkout.state.hold
        : checkout.state.hold;
    const expired =
      checkout.state.step === "held" && checkout.state.expired === true;
    return (
      <main id="main-content" className="reservation-page">
        <div className="reservation-page__header">
          <p className="reservation-page__eyebrow">Despacho a domicilio</p>
          <h1 tabIndex={-1} ref={headingRef}>
            Reservar horario
          </h1>
          <p>Estás a un paso de asegurar la entrega de tu pedido.</p>
        </div>
        <Dialog
          open
          dismissible={checkout.state.step === "held"}
          closeLabel="Cerrar confirmación"
          title="Confirmar reserva"
          onClose={() => {
            if (checkout.state.step === "held") checkout.changeSlot();
          }}
        >
          <HoldConfirmation
            hold={holding}
            address={addressText}
            clock={api.clock}
            expired={expired}
            confirming={checkout.state.step === "confirming"}
            onConfirm={checkout.confirm}
            onChangeSlot={checkout.changeSlot}
            onElapsed={checkout.expire}
          />
        </Dialog>
        {checkoutNotice && checkoutNotice.kind !== "slotFull" ? (
          <CheckoutNoticeMessage
            notice={checkoutNotice}
            onRetry={checkout.retry}
          />
        ) : null}
      </main>
    );
  }
  if (checkout.state.step === "confirmed")
    return (
      <main id="main-content" className="reservation-page">
        <div className="reservation-page__header">
          <p className="reservation-page__eyebrow">Despacho a domicilio</p>
          <h1 tabIndex={-1} ref={headingRef}>
            Reservar horario
          </h1>
        </div>
        <ReservationSuccess
          reservation={checkout.state.reservation}
          address={addressText}
          customerName={customer.name}
          onStartNewCheckout={checkout.startNewCheckout}
        />
      </main>
    );

  return (
    <main id="main-content" className="reservation-page">
      <div className="reservation-page__header">
        <p className="reservation-page__eyebrow">Despacho a domicilio</p>
        <h1 ref={headingRef} tabIndex={-1}>
          Reservar horario
        </h1>
        <p>Elige dónde y cuándo quieres recibir tu pedido.</p>
      </div>
      {address.status.kind === "covered" ? (
        <AddressCard
          customerName={customer.name}
          address={address.status.address}
          onChange={() => setPickerOpen(true)}
        />
      ) : address.status.kind === "notCovered" ? (
        <NotCoveredState
          reason={address.status.reason}
          onChange={() => setPickerOpen(true)}
        />
      ) : (
        <Button onClick={() => setPickerOpen(true)}>Elegir dirección</Button>
      )}
      <AddressPicker
        open={pickerOpen}
        onSelect={(candidate) => {
          setPickerOpen(false);
          void address.submit(candidate);
        }}
        apiErrors={
          address.status.kind === "invalid"
            ? address.status.fieldErrors
            : undefined
        }
      />
      {address.status.kind === "checking" ? (
        <Spinner label="Verificando cobertura…" />
      ) : null}
      {address.status.kind === "error" ? (
        <StatusMessage tone="error">
          No fue posible verificar la dirección.{" "}
          <Button onClick={address.retry}>Reintentar</Button>
        </StatusMessage>
      ) : null}
      {covered ? (
        <>
          <DateStrip
            dates={dates.dates}
            selectedDate={dates.selectedDate}
            isLoading={dates.isLoading}
            error={dates.error}
            onSelect={(date) => {
              dates.select(date);
              slots.clear();
            }}
            onRetry={() => void dates.retry()}
            onChangeAddress={() => setPickerOpen(true)}
          />
          {dates.notice ? (
            <StatusMessage tone="notice">
              La fecha elegida ya no está disponible.
            </StatusMessage>
          ) : null}
          <SlotList
            slots={slots.slots}
            selectedSlotId={slots.selectedSlot?.slotId ?? null}
            isLoading={slots.isLoading}
            error={slots.error}
            onSelect={slots.select}
            onRetry={() => void slots.retry()}
          />
        </>
      ) : null}
      {checkoutNotice ? (
        <div ref={noticeRef} tabIndex={-1}>
          {checkoutNotice.kind === "slotFull" ? (
            <SlotFullNotice
              alternatives={checkoutNotice.alternatives}
              timeZone="America/Santiago"
              onPickAlternative={(alternative) => {
                dates.select(alternative.deliveryDate);
                slots.preselect(alternative.slotId);
                checkout.dismissNotice();
              }}
            />
          ) : (
            <CheckoutNoticeMessage
              notice={checkoutNotice}
              onRetry={checkout.retry}
            />
          )}
        </div>
      ) : null}
      <Button
        disabled={!canReserve}
        busy={checkout.state.step === "holding"}
        onClick={() => {
          if (slots.selectedSlot) checkout.reserve(slots.selectedSlot.slotId);
        }}
      >
        Reservar
      </Button>
    </main>
  );
}
