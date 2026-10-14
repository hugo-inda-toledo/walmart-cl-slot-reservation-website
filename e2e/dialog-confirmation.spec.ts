import { expect, test } from "@playwright/test";

import { FIXTURES } from "../src/test/msw/fixtures";
import { selectDemoAddress, selectFirstAvailableDateAndSlot } from "./helpers";

test("cierra, reabre, cancela y confirma con teclado sin liberar durante confirmación", async ({
  page,
}) => {
  let releases = 0;
  let finishConfirmation: () => void = () => undefined;
  const pendingConfirmation = new Promise<void>((resolve) => {
    finishConfirmation = resolve;
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let fixtureName: string;
    if (path.endsWith("/confirm")) {
      await pendingConfirmation;
      fixtureName = "confirm-hold-success";
    } else if (request.method() === "DELETE") {
      releases += 1;
      fixtureName = "release-hold-success";
    } else if (path.endsWith("/slot-holds")) {
      fixtureName = "create-hold-success";
    } else if (path.endsWith("/demo-addresses")) {
      fixtureName = "list-demo-addresses-success";
    } else if (path.endsWith("/coverage/resolve")) {
      fixtureName = "resolve-coverage-success";
    } else if (path.endsWith("/delivery-dates")) {
      fixtureName = "list-dates-success-all-states";
    } else if (path.endsWith("/slots")) {
      fixtureName = "list-slots-success-all-states";
    } else if (path.endsWith("/regions")) {
      fixtureName = "list-regions-success";
    } else {
      throw new Error(`Petición no prevista en el checkout: ${path}`);
    }
    const fixture = FIXTURES.find((entry) => entry.name === fixtureName);
    if (!fixture) throw new Error(`Fixture no encontrada: ${fixtureName}`);
    await route.fulfill({
      status: fixture.status,
      contentType: fixture.contentType,
      ...(fixture.body === undefined
        ? {}
        : { body: JSON.stringify(fixture.body) }),
    });
  });

  try {
    await page.goto("/");
    await selectDemoAddress(page, "Monjitas");
    const dialog = page.getByRole("dialog", { name: "Confirmar reserva" });
    const close = dialog.getByRole("button", { name: "Cerrar confirmación" });
    const cancel = dialog.getByRole("button", { name: "Cancelar reserva" });
    const confirm = dialog.getByRole("button", { name: "Confirmar" });

    for (const action of ["close", "cancel", "escape"] as const) {
      await selectFirstAvailableDateAndSlot(page);
      await page.getByRole("button", { name: "Reservar" }).focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeFocused();
      await expect(close).toBeVisible();
      await expect(cancel).toBeVisible();
      if (action === "close") {
        await page.keyboard.press("Tab");
        await expect(close).toBeFocused();
        await page.keyboard.press("Enter");
      } else if (action === "cancel") {
        await page.keyboard.press("Shift+Tab");
        await expect(cancel).toBeFocused();
        await page.keyboard.press("Enter");
      } else {
        await page.keyboard.press("Escape");
      }
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Reservar horario" }),
      ).toBeFocused();
    }
    expect(releases).toBe(3);

    await selectFirstAvailableDateAndSlot(page);
    await page.getByRole("button", { name: "Reservar" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(dialog.getByRole("status")).toContainText(
      "Confirmando reserva",
    );
    await expect(dialog.getByRole("button")).toHaveCount(0);
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element: HTMLDialogElement) => {
      element.requestClose();
    });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element: HTMLDialogElement) => {
      element.close();
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog).toBeFocused();
    expect(releases).toBe(3);

    finishConfirmation();
    await expect(
      page.getByRole("heading", { name: "¡Tu horario está reservado!" }),
    ).toBeVisible();
    expect(releases).toBe(3);
  } finally {
    finishConfirmation();
  }
});
