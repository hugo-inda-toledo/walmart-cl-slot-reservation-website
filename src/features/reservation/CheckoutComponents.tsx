import type {
  AlternativeSlot,
  Booking,
  ReservationSlotSnapshot,
  SlotHold,
} from "@/api/types/reservation";
import type { ServerClock } from "@/api/http/serverClock";
import {
  formatClp,
  formatLongDate,
  formatTimeRange,
  parseCalendarDate,
} from "@/shared/format/formatters";
import { Button, Spinner, StatusMessage } from "@/shared/ui";

import type { CheckoutNotice } from "./model/checkoutMachine";
import { Countdown } from "./Countdown";

interface DeliveryDetailsProps {
  readonly slot: ReservationSlotSnapshot;
  readonly address: string;
}

export interface HoldConfirmationProps extends Omit<
  DeliveryDetailsProps,
  "slot"
> {
  readonly hold: SlotHold;
  readonly clock: ServerClock;
  readonly expired: boolean;
  readonly confirming: boolean;
  readonly onConfirm: () => void;
  readonly onChangeSlot: () => void;
  readonly onElapsed: () => void;
}

export function HoldConfirmation({
  hold,
  address,
  clock,
  expired,
  confirming,
  onConfirm,
  onChangeSlot,
  onElapsed,
}: HoldConfirmationProps) {
  return (
    <section aria-labelledby="hold-confirmation-title">
      <h2 id="hold-confirmation-title">Confirma tu horario de despacho</h2>
      <section
        className="hold-confirmation__summary"
        aria-labelledby="hold-summary-title"
      >
        <h3 id="hold-summary-title">Resumen de entrega</h3>
        <dl>
          <div>
            <dt>Dirección</dt>
            <dd>{address}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{formatLongDate(parseCalendarDate(hold.slot.deliveryDate))}</dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>
              {formatTimeRange(
                hold.slot.start,
                hold.slot.end,
                hold.slot.timeZone,
              )}
            </dd>
          </div>
        </dl>
      </section>
      <section
        className="hold-confirmation__status"
        aria-labelledby="hold-status-title"
      >
        <h3 id="hold-status-title">Estado de tu reserva</h3>
        <dl>
          <div>
            <dt>Costo de despacho</dt>
            <dd>{formatClp(hold.slot.price)}</dd>
          </div>
        </dl>
        {confirming ? (
          <p role="status">
            <Spinner label="Confirmando reserva…" />
            <span aria-hidden="true">Confirmando reserva…</span>
          </p>
        ) : (
          <p>
            Tiempo para confirmar:{" "}
            <Countdown
              expiresAt={hold.expiresAt}
              clock={clock}
              onElapsed={onElapsed}
            />
          </p>
        )}
      </section>
      {!confirming ? (
        <>
          {expired ? (
            <StatusMessage tone="notice">
              <p>
                La retención venció. Elige otro horario con la disponibilidad
                actualizada.
              </p>
              <Button onClick={onChangeSlot}>Elegir otro horario</Button>
            </StatusMessage>
          ) : null}
          <div
            className="hold-confirmation__actions"
            role="group"
            aria-label="Acciones de reserva"
          >
            <Button disabled={expired} onClick={onConfirm}>
              Confirmar
            </Button>
            <Button className="ui-button--secondary" onClick={onChangeSlot}>
              Cancelar reserva
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export interface ReservationSuccessProps extends Omit<
  DeliveryDetailsProps,
  "slot"
> {
  readonly reservation: Booking;
  readonly customerName: string;
  readonly onStartNewCheckout: () => void;
}

export function ReservationSuccess({
  reservation,
  address,
  customerName,
  onStartNewCheckout,
}: ReservationSuccessProps) {
  return (
    <section aria-labelledby="reservation-success-title">
      <h2 id="reservation-success-title">¡Tu horario está reservado!</h2>
      <p>
        Identificador de reserva: <strong>{reservation.reservationId}</strong>
      </p>
      <DeliveryDetails slot={reservation.slot} address={address} />
      <p>Cliente: {customerName}</p>
      <Button onClick={onStartNewCheckout}>Hacer otra reserva</Button>
    </section>
  );
}

export interface SlotFullNoticeProps {
  readonly alternatives: readonly AlternativeSlot[];
  readonly timeZone: string;
  readonly onPickAlternative: (alternative: AlternativeSlot) => void;
}

export function SlotFullNotice({
  alternatives,
  timeZone,
  onPickAlternative,
}: SlotFullNoticeProps) {
  if (alternatives.length === 0) {
    return (
      <StatusMessage tone="notice">
        <p>El horario acaba de agotarse. Elige otro horario u otra fecha.</p>
      </StatusMessage>
    );
  }

  return (
    <StatusMessage tone="notice">
      <p>
        El horario acaba de agotarse. Puedes elegir una de estas alternativas.
      </p>
      <ul aria-label="Horarios alternativos">
        {alternatives.map((alternative) => (
          <li key={alternative.slotId}>
            <p>{formatLongDate(parseCalendarDate(alternative.deliveryDate))}</p>
            <p>
              {formatTimeRange(alternative.start, alternative.end, timeZone)}
            </p>
            <p>{formatClp(alternative.price)}</p>
            <p>Quedan {String(alternative.remainingCapacity)} cupos</p>
            <Button
              onClick={() => {
                onPickAlternative(alternative);
              }}
            >
              Elegir
            </Button>
          </li>
        ))}
      </ul>
    </StatusMessage>
  );
}

export interface CheckoutNoticeMessageProps {
  readonly notice: Exclude<CheckoutNotice, { readonly kind: "slotFull" }>;
  readonly onRetry?: () => void;
}

export function CheckoutNoticeMessage({
  notice,
  onRetry,
}: CheckoutNoticeMessageProps) {
  const content = noticeContent(notice);
  const canRetry =
    onRetry !== undefined &&
    (notice.kind === "keyReused" ||
      notice.kind === "connection" ||
      notice.kind === "unexpected");

  return (
    <StatusMessage tone={content.tone} supportCode={content.supportCode}>
      <p>{content.message}</p>
      {canRetry ? <Button onClick={onRetry}>Reintentar</Button> : null}
    </StatusMessage>
  );
}

function DeliveryDetails({ slot, address }: DeliveryDetailsProps) {
  return (
    <dl>
      <div>
        <dt>Fecha</dt>
        <dd>{formatLongDate(parseCalendarDate(slot.deliveryDate))}</dd>
      </div>
      <div>
        <dt>Horario</dt>
        <dd>{formatTimeRange(slot.start, slot.end, slot.timeZone)}</dd>
      </div>
      <div>
        <dt>Costo de despacho</dt>
        <dd>{formatClp(slot.price)}</dd>
      </div>
      <div>
        <dt>Dirección</dt>
        <dd>{address}</dd>
      </div>
    </dl>
  );
}

function noticeContent(notice: Exclude<CheckoutNotice, { kind: "slotFull" }>) {
  switch (notice.kind) {
    case "slotClosed":
      return {
        tone: "notice" as const,
        message: "Este horario ya no admite reservas.",
      };
    case "slotGone":
      return {
        tone: "notice" as const,
        message: "El horario ya no está disponible.",
      };
    case "holdExpired":
      return {
        tone: "notice" as const,
        message: "El tiempo para confirmar terminó.",
      };
    case "holdInactive":
      return {
        tone: "notice" as const,
        message: "La retención ya no está vigente.",
      };
    case "holdGone":
      return {
        tone: "notice" as const,
        message: "La retención ya no está disponible.",
      };
    case "sessionInvalid":
      return {
        tone: "error" as const,
        message: "Tu sesión de cliente ya no es válida.",
      };
    case "keyReused":
      return {
        tone: "error" as const,
        message: "No pudimos procesar esta solicitud. Inténtalo nuevamente.",
        supportCode: notice.supportCode,
      };
    case "connection":
      return {
        tone: "error" as const,
        message:
          "No pudimos conectarnos con el servicio. Revisa tu conexión e inténtalo nuevamente.",
      };
    case "unexpected":
      return {
        tone: "error" as const,
        message: "Ocurrió un problema inesperado. Inténtalo nuevamente.",
        supportCode: notice.supportCode,
      };
  }
}
