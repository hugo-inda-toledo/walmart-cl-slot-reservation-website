import { expect, type Page } from "@playwright/test";

export async function selectDemoAddress(page: Page, addressLabel: string) {
  await page.getByRole("button", { name: "Elegir dirección" }).click();
  await page.getByRole("button", { name: new RegExp(addressLabel) }).click();
}

export async function selectFirstAvailableDateAndSlot(page: Page) {
  const dates = page.getByRole("radiogroup", { name: "Fecha de despacho" });
  await expect(dates).toBeVisible();
  await dates
    .locator('[role="radio"]:not([aria-disabled="true"])')
    .first()
    .click();

  const slots = page.getByRole("radiogroup", { name: "Horario de despacho" });
  await expect(slots).toBeVisible();
  await slots
    .locator('[role="radio"]:not([aria-disabled="true"])')
    .first()
    .click();
}
