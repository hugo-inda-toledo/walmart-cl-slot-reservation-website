import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { createReservationScenario } from "@/test/msw/reservationScenario";

import { useCheckout } from "./useCheckout";

const slotId = "62222222-2222-4222-8222-222222222222";

function Probe({
  customerId = "customer-1",
  onSelectionInvalidated = () => undefined,
}: {
  readonly customerId?: string;
  readonly onSelectionInvalidated?: () => void;
}) {
  const checkout = useCheckout({
    customerId,
    onSelectionInvalidated,
  });
  return (
    <>
      <output>{checkout.state.step}</output>
      <output aria-label="aviso">
        {"notice" in checkout.state && checkout.state.notice?.kind}
      </output>
      <output aria-label="vencido">
        {checkout.state.step === "held" && checkout.state.expired
          ? "true"
          : "false"}
      </output>
      <output aria-label="orden">{checkout.orderId}</output>
      <button
        onClick={() => {
          checkout.reserve(slotId);
        }}
      >
        Reservar
      </button>
      <button
        onClick={() => {
          checkout.retry();
        }}
      >
        Reintentar
      </button>
      <button
        onClick={() => {
          checkout.changeSlot();
        }}
      >
        Cambiar
      </button>
      <button
        onClick={() => {
          checkout.confirm();
        }}
      >
        Confirmar
      </button>
      <button
        onClick={() => {
          checkout.expire();
        }}
      >
        Vencer
      </button>
      <button
        onClick={() => {
          checkout.startNewCheckout();
        }}
      >
        Nuevo checkout
      </button>
    </>
  );
}

describe("useCheckout", () => {
  it("libera el hold activo y reintenta una sola vez con una clave nueva", async () => {
    const scenario = createReservationScenario({
      responses: { createSlotHold: ["create-hold-active-exists"] },
    });
    const keys: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (
        request.method === "POST" &&
        request.url.endsWith("/api/v1/slot-holds")
      )
        keys.push(request.headers.get("Idempotency-Key") ?? "");
    });
    renderWithProviders(<Probe />);

    screen.getByRole("button", { name: "Reservar" }).click();

    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
    expect(scenario.responses().map((response) => response.name)).toEqual([
      "create-hold-active-exists",
      "release-hold-not-active",
      "get-hold-not-found",
      "create-hold-success",
    ]);
    expect(sessionStorage.getItem("wcsr:checkout")).toContain("holdId");
  });

  it("reutiliza la clave y el orderId al reintentar un fallo de red", async () => {
    const scenario = createReservationScenario({
      responses: { createSlotHold: [{ kind: "network" }] },
    });
    const keys: string[] = [];
    const orders: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", async ({ request }) => {
      if (
        request.method === "POST" &&
        request.url.endsWith("/api/v1/slot-holds")
      ) {
        keys.push(request.headers.get("Idempotency-Key") ?? "");
        orders.push(
          ((await request.clone().json()) as { orderId: string }).orderId,
        );
      }
    });
    renderWithProviders(<Probe />);
    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("selecting"),
    );
    screen.getByRole("button", { name: "Reintentar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(orders[0]).toBe(orders[1]);
  });

  it("genera una clave nueva para el siguiente intento de hold tras reutilización de clave", async () => {
    const scenario = createReservationScenario({
      responses: { createSlotHold: ["create-hold-idempotency-key-reused"] },
    });
    const keys: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (
        request.method === "POST" &&
        request.url.endsWith("/api/v1/slot-holds")
      )
        keys.push(request.headers.get("Idempotency-Key") ?? "");
    });
    renderWithProviders(<Probe />);

    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getByLabelText("aviso")).toHaveTextContent("keyReused"),
    );
    screen.getByRole("button", { name: "Reintentar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );

    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("libera con el cliente anterior y renueva la orden al cambiar de cliente", async () => {
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    const view = renderWithProviders(<Probe customerId="customer-1" />);
    const before = screen.getByLabelText("orden").textContent;
    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );

    view.rerender(<Probe customerId="customer-2" />);
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("selecting"),
    );
    expect(screen.getByLabelText("orden")).not.toHaveTextContent(before);
    expect(scenario.responses().map((response) => response.name)).toEqual([
      "create-hold-success",
      "release-hold-success",
    ]);
    expect(sessionStorage.getItem("wcsr:checkout")).toContain("customer-2");
  });

  it.each([
    ["confirm-hold-expired", "selecting", "holdExpired"],
    ["confirm-hold-not-active", "selecting", "holdInactive"],
    ["get-hold-not-found", "selecting", "holdGone"],
  ] as const)(
    "vuelve a seleccionar cuando confirmar falla con %s",
    async (response, expectedStep, expectedNotice) => {
      const scenario = createReservationScenario({
        responses: { confirmSlotHold: [response] },
      });
      const invalidated = vi.fn();
      server.use(...scenario.handlers);
      renderWithProviders(<Probe onSelectionInvalidated={invalidated} />);
      screen.getByRole("button", { name: "Reservar" }).click();
      await waitFor(() =>
        expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
      );

      screen.getByRole("button", { name: "Confirmar" }).click();

      await waitFor(() =>
        expect(screen.getAllByRole("status")[0]).toHaveTextContent(
          expectedStep,
        ),
      );
      expect(screen.getByLabelText("aviso")).toHaveTextContent(expectedNotice);
      expect(sessionStorage.getItem("wcsr:checkout")).not.toContain("holdId");
      expect(invalidated).toHaveBeenCalledOnce();
    },
  );

  it("genera una clave nueva para confirmar tras reutilización de clave", async () => {
    const scenario = createReservationScenario({
      responses: {
        confirmSlotHold: ["create-hold-idempotency-key-reused"],
      },
    });
    const keys: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/confirm"))
        keys.push(request.headers.get("Idempotency-Key") ?? "");
    });
    renderWithProviders(<Probe />);
    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );

    screen.getByRole("button", { name: "Confirmar" }).click();
    await waitFor(() =>
      expect(screen.getByLabelText("aviso")).toHaveTextContent("keyReused"),
    );
    screen.getByRole("button", { name: "Reintentar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("confirmed"),
    );

    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("mantiene el hold vencido e invalida el catálogo cuando vence la cuenta regresiva", async () => {
    const invalidated = vi.fn();
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    renderWithProviders(<Probe onSelectionInvalidated={invalidated} />);
    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );

    screen.getByRole("button", { name: "Vencer" }).click();

    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );
    expect(screen.getByLabelText("vencido")).toHaveTextContent("true");
    expect(screen.getByLabelText("aviso")).toBeEmptyDOMElement();
    expect(sessionStorage.getItem("wcsr:checkout")).not.toContain("holdId");
    expect(invalidated).toHaveBeenCalledOnce();
  });

  it("recupera la reserva cuando el hold ya fue confirmado", async () => {
    const scenario = createReservationScenario({
      responses: {
        confirmSlotHold: ["confirm-hold-not-active-reservation"],
        getReservation: ["get-reservation-success"],
      },
    });
    server.use(...scenario.handlers);
    renderWithProviders(<Probe />);
    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );

    screen.getByRole("button", { name: "Confirmar" }).click();

    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("confirmed"),
    );
    expect(sessionStorage.getItem("wcsr:checkout")).toContain("reservationId");
  });

  it("confirma con una clave nueva y reutiliza esa misma clave al reintentar", async () => {
    const scenario = createReservationScenario({
      responses: {
        confirmSlotHold: [
          { kind: "network" },
          { kind: "network" },
          { kind: "network" },
        ],
      },
    });
    const keys: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/confirm"))
        keys.push(request.headers.get("Idempotency-Key") ?? "");
    });
    renderWithProviders(<Probe />);
    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );
    screen.getByRole("button", { name: "Confirmar" }).click();
    await waitFor(
      () =>
        expect(screen.getByLabelText("aviso")).toHaveTextContent("connection"),
      { timeout: 2_500 },
    );
    screen.getByRole("button", { name: "Reintentar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("confirmed"),
    );
    expect(keys).toHaveLength(4);
    expect(new Set(keys.slice(0, 3)).size).toBe(1);
    expect(keys[3]).toBe(keys[0]);
  });

  it("inicia un checkout nuevo con un orderId nuevo después de confirmar", async () => {
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    renderWithProviders(<Probe />);
    const previousOrderId = screen.getByLabelText("orden").textContent;
    screen.getByRole("button", { name: "Reservar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("held"),
    );
    screen.getByRole("button", { name: "Confirmar" }).click();
    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("confirmed"),
    );

    screen.getByRole("button", { name: "Nuevo checkout" }).click();

    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("selecting"),
    );
    expect(screen.getByLabelText("orden")).not.toHaveTextContent(
      previousOrderId,
    );
    expect(sessionStorage.getItem("wcsr:checkout")).not.toContain(
      "reservationId",
    );
  });

  it.each([
    ["get-hold-success", "held"],
    ["get-hold-confirmed", "confirmed"],
    ["get-hold-not-found", "selecting"],
  ] as const)(
    "restaura una sesión guardada según el estado %s",
    async (response, expectedStep) => {
      sessionStorage.setItem(
        "wcsr:checkout",
        JSON.stringify({
          customerId: "customer-1",
          orderId: "order-saved",
          holdId: "44444444-4444-4444-8444-444444444444",
        }),
      );
      const scenario = createReservationScenario({
        responses: {
          getSlotHold: [response],
          ...(response === "get-hold-confirmed"
            ? { getReservation: ["get-reservation-success"] }
            : {}),
        },
      });
      server.use(...scenario.handlers);

      renderWithProviders(<Probe />);

      await waitFor(() =>
        expect(screen.getAllByRole("status")[0]).toHaveTextContent(
          expectedStep,
        ),
      );
      if (expectedStep === "selecting")
        expect(sessionStorage.getItem("wcsr:checkout")).not.toContain("holdId");
    },
  );

  it("restaura la reserva guardada consultándola antes de mostrar el éxito", async () => {
    sessionStorage.setItem(
      "wcsr:checkout",
      JSON.stringify({
        customerId: "customer-1",
        orderId: "order-saved",
        reservationId: "55555555-5555-4555-8555-555555555555",
      }),
    );
    const scenario = createReservationScenario({
      responses: { getReservation: ["get-reservation-success"] },
    });
    server.use(...scenario.handlers);

    renderWithProviders(<Probe />);

    await waitFor(() =>
      expect(screen.getAllByRole("status")[0]).toHaveTextContent("confirmed"),
    );
    expect(scenario.responses().map((response) => response.name)).toEqual([
      "get-reservation-success",
    ]);
  });
});
