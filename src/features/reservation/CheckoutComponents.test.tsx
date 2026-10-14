import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking, SlotHold } from "@/api/types/reservation";
import { createServerClock } from "@/api/http/serverClock";
import { expectNoAxeViolations } from "@/test/axe";
import { renderWithProviders } from "@/test/renderWithProviders";

import {
  CheckoutNoticeMessage,
  HoldConfirmation,
  ReservationSuccess,
  SlotFullNotice,
} from "./CheckoutComponents";

const hold: SlotHold = {
  holdId: "hold-123",
  orderId: "order-123",
  status: "ACTIVE",
  createdAt: "2030-01-01T11:00:00-03:00",
  expiresAt: "2030-01-01T12:15:00-03:00",
  slot: {
    slotId: "slot-123",
    zoneId: "zone-1",
    deliveryDate: "2030-01-15",
    start: "2030-01-15T12:00:00-03:00",
    end: "2030-01-15T14:00:00-03:00",
    price: 2990,
    timeZone: "America/Santiago",
  },
};

const reservation: Booking = {
  reservationId: "reservation-123",
  holdId: hold.holdId,
  orderId: hold.orderId,
  status: "CONFIRMED",
  confirmedAt: "2030-01-01T11:30:00-03:00",
  slot: hold.slot,
};

describe("componentes del checkout", () => {
  it("muestra la confirmación y bloquea confirmar cuando vence o está ocupado", async () => {
    const confirm = vi.fn();
    const changeSlot = vi.fn();
    const { container, rerender } = renderWithProviders(
      <HoldConfirmation
        hold={hold}
        address="Av. Siempre Viva 123, Santiago"
        clock={createServerClock(() => Date.parse("2030-01-01T12:00:00-03:00"))}
        expired={false}
        confirming={false}
        onConfirm={confirm}
        onChangeSlot={changeSlot}
        onElapsed={vi.fn()}
      />,
    );

    expect(screen.getByText("martes 15 de enero")).toBeInTheDocument();
    expect(screen.getByText("12:00pm-2:00pm")).toBeInTheDocument();
    expect(screen.getByText("$2.990")).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Resumen de entrega" });
    expect(
      within(summary).getByText("Av. Siempre Viva 123, Santiago"),
    ).toBeInTheDocument();
    expect(within(summary).getByText("martes 15 de enero")).toBeInTheDocument();
    expect(within(summary).getByText("12:00pm-2:00pm")).toBeInTheDocument();
    expect(within(summary).queryByText("$2.990")).not.toBeInTheDocument();
    const status = screen.getByRole("region", { name: "Estado de tu reserva" });
    expect(within(status).getByText("$2.990")).toBeInTheDocument();
    expect(
      within(status).getByText(/Tiempo para confirmar:/),
    ).toBeInTheDocument();
    const actions = screen.getByRole("group", { name: "Acciones de reserva" });
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Confirmar", "Cancelar reserva"]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar reserva" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(changeSlot).toHaveBeenCalledOnce();
    await expectNoAxeViolations(container);

    rerender(
      <HoldConfirmation
        hold={hold}
        address="Av. Siempre Viva 123, Santiago"
        clock={createServerClock(() => Date.parse("2030-01-01T12:00:00-03:00"))}
        expired
        confirming={false}
        onConfirm={confirm}
        onChangeSlot={changeSlot}
        onElapsed={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Confirmar/i })).toBeDisabled();
    expect(screen.getByText(/La retención venció/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Elegir otro horario" }),
    ).toBeInTheDocument();
  });

  it("muestra sólo progreso sin acciones de confirmar o liberar mientras confirma, aun si vence", () => {
    renderWithProviders(
      <HoldConfirmation
        hold={hold}
        address="Av. Siempre Viva 123, Santiago"
        clock={createServerClock(() => Date.parse("2030-01-01T12:00:00-03:00"))}
        expired
        confirming
        onConfirm={vi.fn()}
        onChangeSlot={vi.fn()}
        onElapsed={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Confirmando reserva");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("muestra comprobante y alternativas agotadas elegibles", async () => {
    const startNewCheckout = vi.fn();
    const pickAlternative = vi.fn();
    const { container } = renderWithProviders(
      <>
        <ReservationSuccess
          reservation={reservation}
          address="Av. Siempre Viva 123, Santiago"
          customerName="María Pérez"
          onStartNewCheckout={startNewCheckout}
        />
        <SlotFullNotice
          alternatives={[
            {
              slotId: "alternative-1",
              deliveryDate: "2030-01-16",
              start: "2030-01-16T16:00:00-03:00",
              end: "2030-01-16T18:00:00-03:00",
              price: 3990,
              remainingCapacity: 2,
            },
          ]}
          timeZone="America/Santiago"
          onPickAlternative={pickAlternative}
        />
      </>,
    );
    expect(screen.getByText("reservation-123")).toBeInTheDocument();
    expect(screen.getByText(/Cliente: María Pérez/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hacer otra reserva" }));
    fireEvent.click(screen.getByRole("button", { name: "Elegir" }));
    expect(startNewCheckout).toHaveBeenCalledOnce();
    expect(pickAlternative).toHaveBeenCalledWith({
      slotId: "alternative-1",
      deliveryDate: "2030-01-16",
      start: "2030-01-16T16:00:00-03:00",
      end: "2030-01-16T18:00:00-03:00",
      price: 3990,
      remainingCapacity: 2,
    });
    expect(screen.getByText("miércoles 16 de enero")).toBeInTheDocument();
    expect(screen.getByText(/Quedan 2 cupos/i)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it.each([
    ["slotClosed", "Este horario ya no admite reservas."],
    ["slotGone", "El horario ya no está disponible."],
    ["holdExpired", "El tiempo para confirmar terminó."],
    ["holdInactive", "La retención ya no está vigente."],
    ["holdGone", "La retención ya no está disponible."],
    ["sessionInvalid", "Tu sesión de cliente ya no es válida."],
    ["keyReused", "No pudimos procesar esta solicitud."],
    ["connection", "No pudimos conectarnos con el servicio."],
    ["unexpected", "Ocurrió un problema inesperado."],
  ] as const)("traduce %s sin mostrar texto técnico", (kind, message) => {
    const retry = vi.fn();
    renderWithProviders(
      <CheckoutNoticeMessage
        notice={
          kind === "keyReused" || kind === "unexpected"
            ? { kind, supportCode: "corr-123" }
            : { kind }
        }
        onRetry={retry}
      />,
    );
    expect(
      screen.getByText(
        new RegExp(message.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")),
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/stack trace|internal server error/i),
    ).not.toBeInTheDocument();
    if (
      kind === "keyReused" ||
      kind === "connection" ||
      kind === "unexpected"
    ) {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(retry).toHaveBeenCalledOnce();
    }
    if (kind === "keyReused" || kind === "unexpected") {
      expect(
        screen.getByText("Código de soporte: corr-123"),
      ).toBeInTheDocument();
    }
  });

  it("sugiere cambiar de fecha cuando no hay alternativas", () => {
    renderWithProviders(
      <SlotFullNotice
        alternatives={[]}
        timeZone="America/Santiago"
        onPickAlternative={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Elige otro horario u otra fecha/i),
    ).toBeInTheDocument();
  });
});
