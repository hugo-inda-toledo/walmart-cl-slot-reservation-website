import { expect, test } from "@playwright/test";

import { cleanupReservation } from "./reservationCleanup";
import { selectDemoAddress, selectFirstAvailableDateAndSlot } from "./helpers";

test.afterEach(async ({ page }) => {
  await cleanupReservation(page);
});

test("reserva, confirma y cancela un horario real", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Cliente demo").selectOption("juan-soto");
  await selectDemoAddress(page, "Monjitas 879, Santiago");
  await selectFirstAvailableDateAndSlot(page);

  await page.getByRole("button", { name: "Reservar" }).click();
  await expect(page.getByText("Tiempo para confirmar:")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(
    page.getByRole("heading", { name: "¡Tu horario está reservado!" }),
  ).toBeVisible();
});
