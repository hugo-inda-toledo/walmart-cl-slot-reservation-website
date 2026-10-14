import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { expectNoAxeViolations } from "@/test/axe";
import { createReservationScenario } from "@/test/msw/reservationScenario";
import { server } from "@/test/msw/server";

async function reachSelection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Elegir dirección" }));
  await user.click(
    await screen.findByRole("button", { name: /Monjitas.*Con cobertura/ }),
  );
  return screen.findByRole("radiogroup", { name: "Fecha de despacho" });
}

describe("ReservationPage accessibility", () => {
  it("mueve el foco al selector de dirección integrado al abrirlo", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Elegir dirección" }));

    expect(
      await screen.findByRole("heading", { name: "Cambiar dirección" }),
    ).toHaveFocus();
  });

  it("has no axe violations in selection, confirmation, and receipt", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    const { container } = render(<App />);

    await reachSelection(user);
    await expectNoAxeViolations(container);

    const slotGroup = await screen.findByRole("radiogroup", {
      name: "Horario de despacho",
    });
    await user.click(
      within(slotGroup).getByRole("radio", { name: /disponible/i }),
    );
    await user.click(screen.getByRole("button", { name: "Reservar" }));
    await screen.findByRole("heading", {
      name: "Confirma tu horario de despacho",
    });
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });
    await expectNoAxeViolations(container);
  });

  it("supports the reservation flow using keyboard after choosing an address, moves focus, and announces steps", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario();
    server.use(...scenario.handlers);
    render(<App />);

    const dateGroup = await reachSelection(user);
    const date = within(dateGroup).getByRole("radio", { name: /disponible/i });
    for (let index = 0; index < 12; index += 1) {
      if (document.activeElement === date) break;
      await user.tab();
    }
    expect(date).toHaveFocus();
    await user.keyboard("{Space}");

    const slotGroup = await screen.findByRole("radiogroup", {
      name: "Horario de despacho",
    });
    const slot = within(slotGroup).getByRole("radio", { name: /disponible/i });
    await user.tab();
    expect(slot).toHaveFocus();
    await user.keyboard("{Space}");
    await user.tab();
    expect(screen.getByRole("button", { name: "Reservar" })).toHaveFocus();
    await user.keyboard("{Enter}");

    const confirmationDialog = await screen.findByRole("dialog", {
      name: "Confirmar reserva",
    });
    expect(
      screen.getByText("Confirma tu horario de despacho", {
        selector: '[aria-live="polite"]',
      }),
    ).toBeInTheDocument();
    expect(confirmationDialog).toHaveFocus();
    expect(document.body).toHaveTextContent("Confirma tu horario de despacho");
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Cerrar confirmación" }),
    ).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
    await user.keyboard("{Enter}");

    await screen.findByRole("heading", { name: "¡Tu horario está reservado!" });
    expect(
      screen.getByRole("heading", { name: "Reservar horario" }),
    ).toHaveFocus();
    expect(
      screen.getByText("Tu horario está reservado", {
        selector: '[aria-live="polite"]',
      }),
    ).toBeInTheDocument();
    expect(confirmationDialog).not.toBeInTheDocument();
  });

  it("moves focus to an error notice and exposes it as an accessible alert", async () => {
    const user = userEvent.setup();
    const scenario = createReservationScenario({
      responses: { createSlotHold: ["create-hold-idempotency-key-reused"] },
    });
    server.use(...scenario.handlers);
    render(<App />);

    await reachSelection(user);
    const slotGroup = await screen.findByRole("radiogroup", {
      name: "Horario de despacho",
    });
    await user.click(
      within(slotGroup).getByRole("radio", { name: /disponible/i }),
    );
    await user.click(screen.getByRole("button", { name: "Reservar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos procesar esta solicitud");
    expect(alert.parentElement).toHaveFocus();
    expect(
      screen.getByText("Se produjo un aviso en la reserva", {
        selector: '[aria-live="assertive"]',
      }),
    ).toBeInTheDocument();
  });
});
