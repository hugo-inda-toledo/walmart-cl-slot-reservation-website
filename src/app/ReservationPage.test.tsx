import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http, type DefaultBodyType } from "msw";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { expectNoAxeViolations } from "@/test/axe";
import { FIXTURES, type FixtureEntry } from "@/test/msw/fixtures";
import { createReservationScenario } from "@/test/msw/reservationScenario";
import { server } from "@/test/msw/server";

async function selectDemoAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Elegir dirección" }));
  await user.click(
    await screen.findByRole("button", { name: /Monjitas.*Con cobertura/ }),
  );
  await screen.findByRole("radiogroup", { name: "Fecha de despacho" });
}

async function selectAvailableSlot(user: ReturnType<typeof userEvent.setup>) {
  const group = await screen.findByRole("radiogroup", {
    name: "Horario de despacho",
  });
  await user.click(within(group).getByRole("radio", { name: /disponible/i }));
}

describe("ReservationPage", () => {
  it.each(["Cerrar confirmación", "Cancelar reserva"])(
    "%s libera sólo el hold activo y regresa a selección con foco",
    async (action) => {
      const user = userEvent.setup();
      const scenario = createReservationScenario();
      server.use(...scenario.handlers);
      renderApp();

      await selectDemoAddress(user);
      await selectAvailableSlot(user);
      await user.click(screen.getByRole("button", { name: "Reservar" }));
      const dialog = await screen.findByRole("dialog", {
        name: "Confirmar reserva",
      });
      await user.click(within(dialog).getByRole("button", { name: action }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("heading", { name: "Reservar horario" }),
      ).toHaveFocus();
      expect(
        scenario
          .responses()
          .filter((entry) => entry.name === "release-hold-success"),
      ).toHaveLength(1);
      expect(
        scenario
          .responses()
          .some((entry) => entry.name === "confirm-hold-success"),
      ).toBe(false);
    },
  );

  it("bloquea Escape, cancelación y cierre nativo sin liberar en paralelo durante confirmación", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    let finishConfirmation: () => void = () => undefined;
    const pendingConfirmation = new Promise<void>((resolve) => {
      finishConfirmation = resolve;
    });
    let releases = 0;
    server.use(
      http.post("/api/v1/slot-holds/:holdId/confirm", async () => {
        await pendingConfirmation;
        return HttpResponse.json(
          fixture("confirm-hold-success").body as DefaultBodyType,
        );
      }),
      http.delete("/api/v1/slot-holds/:holdId", () => {
        releases += 1;
        return new HttpResponse(null, { status: 204 });
      }),
      ...scenario.handlers,
    );
    renderApp();

    try {
      await selectDemoAddress(user);
      await selectAvailableSlot(user);
      await user.click(screen.getByRole("button", { name: "Reservar" }));
      const dialog = await screen.findByRole("dialog", {
        name: "Confirmar reserva",
      });
      await user.click(
        within(dialog).getByRole("button", { name: "Confirmar" }),
      );
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "Confirmando reserva",
      );
      expect(within(dialog).queryByRole("button")).not.toBeInTheDocument();

      await user.keyboard("{Escape}");
      const cancel = new Event("cancel", { cancelable: true });
      fireEvent(dialog, cancel);
      expect(cancel.defaultPrevented).toBe(true);
      dialog.removeAttribute("open");
      fireEvent(dialog, new Event("close"));
      expect(dialog).toHaveAttribute("open");
      await user.tab();
      expect(dialog).toHaveFocus();
      expect(releases).toBe(0);
    } finally {
      finishConfirmation();
      await screen.findByRole("heading", {
        name: "¡Tu horario está reservado!",
      });
    }
    expect(releases).toBe(0);
  });

  it("completa dirección, fecha, bloque, reserva y confirmación", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    expect(screen.getByRole("button", { name: "Reservar" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    expect(
      await screen.findByRole("dialog", { name: "Confirmar reserva" }),
    ).toBeVisible();
    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });

    expect(scenario.responses().map((response) => response.name)).toEqual(
      expect.arrayContaining(["create-hold-success", "confirm-hold-success"]),
    );
  });

  it("envía la identidad del cliente solo por header al reservar", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    const observed: {
      readonly customer: string | null;
      readonly body: unknown;
    }[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "POST" && request.url.includes("/slot-holds"))
        observed.push({
          customer: request.headers.get("X-Customer-Id"),
          body: await request.clone().text(),
        });
    });
    renderApp();

    await user.selectOptions(
      within(screen.getByRole("banner")).getByRole("combobox", {
        name: "Cliente demo",
      }),
      "maria-gonzalez",
    );

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });

    expect(observed).toHaveLength(1);
    expect(observed[0]?.customer).toBe("maria-gonzalez");
    expect(observed[0]?.body).not.toContain("customerId");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });
    expect(observed).toHaveLength(2);
    expect(observed[1]?.customer).toBe("maria-gonzalez");
    expect(observed[1]?.body).not.toContain("customerId");
  });

  it("muestra alternativas de SLOT_FULL y retiene la alternativa elegida", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: { createSlotHold: ["create-hold-slot-full"] },
    });
    server.use(...scenario.handlers, ...alternativeCatalogHandlers());
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("list", { name: "Horarios alternativos" });

    await user.click(screen.getByRole("button", { name: "Elegir" }));
    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: /16 ene.*disponible/i }),
      ).toBeChecked(),
    );

    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });
    expect(scenario.responses().map((response) => response.name)).toEqual(
      expect.arrayContaining(["create-hold-slot-full", "create-hold-success"]),
    );
  });

  it("libera el hold previo y crea otro ante ACTIVE_HOLD_EXISTS", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: { createSlotHold: ["create-hold-active-exists"] },
    });
    let releases = 0;
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (request.method === "DELETE" && request.url.includes("/slot-holds/"))
        releases += 1;
    });
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });

    expect(releases).toBe(1);
    expect(scenario.responses().map((response) => response.name)).toEqual(
      expect.arrayContaining([
        "create-hold-active-exists",
        "create-hold-success",
      ]),
    );
  });

  it("emite un solo POST lógico cuando se activa Reservar dos veces", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    let creates = 0;
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/slot-holds"))
        creates += 1;
    });
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    const reserve = screen.getByRole("button", { name: "Reservar" });
    await user.dblClick(reserve);
    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });

    expect(creates).toBe(1);
  });

  it("reintenta una red caída con la misma clave y permite reintentar el intento", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: {
        createSlotHold: [
          { kind: "network" },
          { kind: "network" },
          { kind: "network" },
          "create-hold-success",
        ],
      },
    });
    const keys: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/slot-holds"))
        keys.push(request.headers.get("Idempotency-Key") ?? "");
    });
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByText(
      /No pudimos conectarnos con el servicio/i,
      {},
      {
        timeout: 3_000,
      },
    );
    expect(new Set(keys).size).toBe(1);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole(
      "heading",
      {
        name: "Confirma tu horario de despacho",
      },
      { timeout: 3_000 },
    );
    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(1);
  });

  it("espera una petición en curso y conserva la misma clave", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: {
        createSlotHold: [
          "create-hold-idempotency-progress",
          "create-hold-success",
        ],
      },
    });
    const keys: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (request.method === "POST" && request.url.endsWith("/slot-holds"))
        keys.push(request.headers.get("Idempotency-Key") ?? "");
    });
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole(
      "heading",
      {
        name: "Confirma tu horario de despacho",
      },
      { timeout: 3_000 },
    );

    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
  });

  it.each([
    ["confirm-hold-expired", /El tiempo para confirmar terminó/i],
    ["confirm-hold-not-active", /La retención ya no está vigente/i],
  ])("vuelve a selección ante %s", async (response, message) => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: { confirmSlotHold: [response] },
    });
    server.use(...scenario.handlers);
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("button", { name: "Confirmar" });
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await screen.findByText(message);
    expect(
      screen.getByRole("button", { name: "Reservar" }),
    ).toBeInTheDocument();
  });

  it("mantiene la confirmación vencida y permite elegir otro horario", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    const hold = fixture("create-hold-success").body as Record<string, unknown>;
    server.use(
      http.post("/api/v1/slot-holds", () =>
        HttpResponse.json(
          { ...hold, expiresAt: new Date(Date.now() + 20).toISOString() },
          { status: 201 },
        ),
      ),
      ...scenario.handlers,
    );
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("button", { name: "Confirmar" });
    await screen.findByText(/La retención venció/i, {}, { timeout: 2_000 });
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Elegir otro horario" }),
    ).toBeInTheDocument();
  });

  it("carga el comprobante cuando HOLD_NOT_ACTIVE informa una reserva", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: {
        confirmSlotHold: ["confirm-hold-not-active-reservation"],
        getReservation: ["get-reservation-success"],
      },
    });
    server.use(...scenario.handlers);
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("button", { name: "Confirmar" });
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });
  });

  it("carga el comprobante cuando la orden ya estaba reservada", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: {
        createSlotHold: ["create-hold-order-reserved"],
        getReservation: ["get-reservation-success"],
      },
    });
    server.use(...scenario.handlers);
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));

    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });
  });

  it("restaura un hold activo y una reserva persistidos", async () => {
    const holdScenario = createReservationScenario({
      responses: { getSlotHold: ["get-hold-success"] },
    });
    sessionStorage.setItem(
      "wcsr:checkout",
      JSON.stringify({
        customerId: "pedro-perez",
        orderId: "order-restored-hold",
        holdId: "44444444-4444-4444-8444-444444444444",
      }),
    );
    server.use(...holdScenario.handlers);
    const first = renderApp();

    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });
    first.unmount();

    sessionStorage.setItem(
      "wcsr:checkout",
      JSON.stringify({
        customerId: "pedro-perez",
        orderId: "order-restored-reservation",
        reservationId: "55555555-5555-4555-8555-555555555555",
      }),
    );
    const reservationScenario = createReservationScenario({
      responses: { getReservation: ["get-reservation-success"] },
    });
    server.use(...reservationScenario.handlers);
    renderApp();

    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });
  });

  it("libera el hold del cliente anterior al cambiar de cliente", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    const releases: string[] = [];
    server.use(...scenario.handlers);
    server.events.on("request:start", ({ request }) => {
      if (request.method === "DELETE" && request.url.includes("/slot-holds/"))
        releases.push(request.headers.get("X-Customer-Id") ?? "");
    });
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("button", { name: "Confirmar" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Cliente demo" }),
      "maria-gonzalez",
    );

    await screen.findByRole("button", { name: "Reservar" });
    expect(releases).toEqual(["pedro-perez"]);
  });

  it("muestra el estado sin cobertura cuando fechas responde ADDRESS_NOT_COVERED", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    server.use(
      http.get("/api/v1/delivery-dates", () =>
        HttpResponse.json(
          fixture("list-dates-not-covered-comuna_not_served")
            .body as DefaultBodyType,
          {
            status: 422,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
      ...scenario.handlers,
    );
    renderApp();

    await user.click(screen.getByRole("button", { name: "Elegir dirección" }));
    await user.click(
      await screen.findByRole("button", { name: /Monjitas.*Con cobertura/ }),
    );
    await screen.findByRole("heading", {
      name: "No tenemos despacho en esta dirección.",
    });
    expect(
      screen.queryByRole("radiogroup", { name: "Fecha de despacho" }),
    ).not.toBeInTheDocument();
  });

  it("refresca la selección cuando los bloques reportan fecha fuera de rango", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    let slotRequests = 0;
    server.use(
      http.get("/api/v1/delivery-dates/:date/slots", () => {
        slotRequests += 1;
        const response = fixture(
          slotRequests === 1
            ? "list-slots-date-out-of-range"
            : "list-slots-success-all-states",
        );
        return HttpResponse.json(response.body as DefaultBodyType, {
          status: response.status,
          headers: { "content-type": response.contentType },
        });
      }),
      ...scenario.handlers,
    );
    renderApp();

    await selectDemoAddress(user);
    await screen.findByText("La fecha elegida ya no está disponible.");
    await screen.findByRole("radiogroup", { name: "Horario de despacho" });
    expect(slotRequests).toBeGreaterThan(1);
  });

  it.each([
    ["CORS_REJECTED", 403, "corr-cors"],
    ["INTERNAL_ERROR", 500, "corr-500"],
  ])(
    "muestra el error genérico y su soporte para %s",
    async (code, status, correlationId) => {
      const user = userEvent.setup();
      const scenario = createReservationScenario();
      server.use(
        http.post("/api/v1/slot-holds", () =>
          HttpResponse.json(
            {
              type: "https://api.walmart.cl/problems/unexpected",
              title: "Error interno",
              status,
              code,
              correlationId,
            },
            { status, headers: { "content-type": "application/problem+json" } },
          ),
        ),
        ...scenario.handlers,
      );
      renderApp();

      await selectDemoAddress(user);
      await selectAvailableSlot(user);
      await user.click(screen.getByRole("button", { name: "Reservar" }));

      await screen.findByText(/Ocurrió un problema inesperado/i);
      expect(
        screen.getByText(`Código de soporte: ${correlationId}`),
      ).toBeInTheDocument();
    },
  );

  it("conserva dirección, fecha y bloque elegidos si la API de reserva es inalcanzable", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: {
        createSlotHold: [
          { kind: "network" },
          { kind: "network" },
          { kind: "network" },
        ],
      },
    });
    server.use(...scenario.handlers);
    renderApp();

    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByText(
      /No pudimos conectarnos con el servicio/i,
      {},
      { timeout: 3_000 },
    );

    expect(screen.getByText("Monjitas 500")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /15 ene.*disponible/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /12:00pm-2:00pm.*disponible/i }),
    ).toBeChecked();
  });

  it("permite recorrer una reserva completa con teclado y no introduce infracciones axe", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    const { container } = renderApp();

    await expectNoAxeViolations(container);
    await selectDemoAddress(user);
    await selectAvailableSlot(user);
    await user.tab();
    await user.keyboard("{Enter}");
    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });
    await expectNoAxeViolations(container);
  });
});

function renderApp() {
  return render(<App />);
}

function fixture(name: string): FixtureEntry {
  const found = FIXTURES.find((entry) => entry.name === name);
  if (!found) throw new Error(`No existe fixture ${name}.`);
  return found;
}

function alternativeCatalogHandlers() {
  const dates = fixture("list-dates-success-all-states");
  const slots = fixture("list-slots-success-all-states");
  const dateBody = dates.body as {
    readonly dates: readonly {
      readonly date: string;
      readonly status: string;
    }[];
  };
  const slotBody = slots.body as {
    readonly slots: readonly {
      readonly slotId: string;
      readonly start: string;
      readonly end: string;
      readonly price: number;
      readonly remainingCapacity: number;
      readonly status: string;
    }[];
  };
  const alternativeDate = "2030-01-16";
  const alternativeSlot = "33333333-3333-4333-8333-333333333333";
  return [
    http.get("/api/v1/delivery-dates", () =>
      HttpResponse.json({
        ...(dates.body as object),
        dates: dateBody.dates.map((item) =>
          item.date === alternativeDate
            ? { ...item, status: "AVAILABLE" }
            : item,
        ),
      }),
    ),
    http.get("/api/v1/delivery-dates/:date/slots", ({ params }) =>
      HttpResponse.json({
        ...(slots.body as object),
        date: String(params.date),
        slots:
          String(params.date) === alternativeDate
            ? [
                {
                  ...slotBody.slots[0],
                  slotId: alternativeSlot,
                  start: "2030-01-16T12:00:00-03:00",
                  end: "2030-01-16T14:00:00-03:00",
                  status: "AVAILABLE",
                },
              ]
            : slotBody.slots,
      }),
    ),
  ];
}
