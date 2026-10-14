import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { renderWithProviders } from "@/test/renderWithProviders";

import {
  Button,
  Dialog,
  EmptyState,
  RadioCardGroup,
  Spinner,
  StatusMessage,
  useAnnounce,
} from "./index";

const radioOptions = [
  { value: "today", disabled: false, accessibleLabel: "Hoy, disponible" },
  { value: "tomorrow", disabled: true, accessibleLabel: "Mañana, agotado" },
  { value: "friday", disabled: false, accessibleLabel: "Viernes, disponible" },
] as const;

function RadioCardGroupExample({
  orientation = "horizontal",
}: {
  readonly orientation?: "horizontal" | "vertical";
}) {
  const [value, setValue] = useState<
    (typeof radioOptions)[number]["value"] | null
  >("today");

  return (
    <>
      <RadioCardGroup
        label="Fecha de despacho"
        orientation={orientation}
        options={radioOptions}
        value={value}
        onChange={setValue}
        renderOption={(option, state) => (
          <span>
            {option.value} {state.checked ? "seleccionada" : ""}
          </span>
        )}
      />
      <button type="button">Continuar</button>
    </>
  );
}

function AnnouncementTrigger() {
  const announce = useAnnounce();
  return (
    <button
      type="button"
      onClick={() => {
        announce("Paso actualizado");
      }}
    >
      Anunciar
    </button>
  );
}

function DialogExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Abrir diálogo
      </button>
      <Dialog
        open={open}
        title="Cambiar dirección"
        closeLabel="Cerrar confirmación"
        onClose={() => {
          setOpen(false);
        }}
      >
        <p>Contenido del diálogo</p>
        <button type="button">Confirmar</button>
      </Dialog>
    </>
  );
}

function ConfirmingDialogExample({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      open
      dismissible={false}
      title="Confirmando reserva"
      onClose={onClose}
    >
      <p>Estamos confirmando tu horario.</p>
    </Dialog>
  );
}

describe("UiKit", () => {
  it("expone estados de progreso, mensaje y vacío con roles accesibles", async () => {
    const { container } = renderWithProviders(
      <>
        <Button busy>Reservar</Button>
        <Spinner />
        <StatusMessage tone="error" supportCode="corr-123">
          No fue posible reservar.
        </StatusMessage>
        <StatusMessage tone="notice">Horario actualizado.</StatusMessage>
        <EmptyState title="Sin horarios">Cambia la dirección.</EmptyState>
      </>,
    );

    expect(screen.getByRole("button", { name: /reservar/i })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getAllByText("Cargando…")).not.toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Código de soporte: corr-123",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Horario actualizado.",
    );
    expect(
      screen.getByRole("heading", { name: "Sin horarios" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("bloquea activaciones repetidas mientras el botón está ocupado", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <Button busy onClick={onClick}>
        Confirmar
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("anuncia mensajes mediante una única región live", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnnouncementTrigger />);

    await user.click(screen.getByRole("button", { name: "Anunciar" }));

    const announcers = document.querySelectorAll("[aria-live]");
    expect(announcers).toHaveLength(1);
    expect(announcers[0]).toHaveTextContent("Paso actualizado");
  });

  it("devuelve el foco al activador al cerrar el diálogo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DialogExample />);
    const trigger = screen.getByRole("button", { name: "Abrir diálogo" });

    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Cambiar dirección" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("no permite cerrar un diálogo mientras la acción está confirmándose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ConfirmingDialogExample onClose={onClose} />);

    const dialog = screen.getByRole("dialog", {
      name: "Confirmando reserva",
    });
    await user.keyboard("{Escape}");

    expect(dialog).toBeVisible();
    expect(dialog).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cierra con un control visible configurable, devuelve el foco y permite reabrir", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DialogExample />);
    const trigger = screen.getByRole("button", { name: "Abrir diálogo" });

    await user.click(trigger);
    const close = screen.getByRole("button", { name: "Cerrar confirmación" });
    expect(close).toBeVisible();
    await user.click(close);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("mantiene Tab y Shift+Tab dentro del diálogo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DialogExample />);
    await user.click(screen.getByRole("button", { name: "Abrir diálogo" }));
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", {
      name: "Cerrar confirmación",
    });
    const confirm = within(dialog).getByRole("button", { name: "Confirmar" });

    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });

  it("restaura un cierre nativo y bloquea cancelación y Tab sin acciones mientras confirma", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ConfirmingDialogExample onClose={onClose} />);
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).queryByRole("button")).not.toBeInTheDocument();
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    dialog.removeAttribute("open");
    fireEvent(dialog, new Event("close"));

    expect(dialog).toHaveAttribute("open");
    expect(onClose).not.toHaveBeenCalled();
    await user.tab();
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog).toHaveFocus();
  });

  it("expone una selección única con nombre, estado y opciones no disponibles descubribles", async () => {
    const { container } = renderWithProviders(<RadioCardGroupExample />);

    const group = screen.getByRole("radiogroup", {
      name: "Fecha de despacho",
    });
    const today = screen.getByRole("radio", { name: "Hoy, disponible" });
    const tomorrow = screen.getByRole("radio", { name: "Mañana, agotado" });

    expect(group).toHaveAttribute("aria-orientation", "horizontal");
    expect(today).toHaveAttribute("aria-checked", "true");
    expect(tomorrow).toHaveAttribute("aria-checked", "false");
    expect(tomorrow).toHaveAttribute("aria-disabled", "true");
    await expectNoAxeViolations(container);
  });

  it("entra y sale con Tab, navega con flechas saltando opciones no disponibles y selecciona con Espacio", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RadioCardGroupExample />);

    await user.tab();
    const today = screen.getByRole("radio", { name: "Hoy, disponible" });
    const friday = screen.getByRole("radio", { name: "Viernes, disponible" });
    expect(today).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(friday).toHaveFocus();
    expect(friday).toHaveAttribute("aria-checked", "false");

    await user.keyboard(" ");
    expect(friday).toHaveAttribute("aria-checked", "true");

    await user.tab();
    expect(screen.getByRole("button", { name: "Continuar" })).toHaveFocus();
  });

  it("no selecciona opciones no disponibles mediante clic ni teclado y soporta Inicio/Fin vertical", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RadioCardGroupExample orientation="vertical" />);

    const today = screen.getByRole("radio", { name: "Hoy, disponible" });
    const tomorrow = screen.getByRole("radio", { name: "Mañana, agotado" });
    const friday = screen.getByRole("radio", { name: "Viernes, disponible" });

    await user.click(tomorrow);
    expect(today).toHaveAttribute("aria-checked", "true");
    expect(tomorrow).toHaveAttribute("aria-checked", "false");

    tomorrow.focus();
    await user.keyboard(" ");
    expect(today).toHaveAttribute("aria-checked", "true");
    expect(tomorrow).toHaveAttribute("aria-checked", "false");

    today.focus();
    await user.keyboard("{ArrowDown}");
    expect(friday).toHaveFocus();
    await user.keyboard("{Home}");
    expect(today).toHaveFocus();
    await user.keyboard("{End}");
    expect(friday).toHaveFocus();
  });
});
