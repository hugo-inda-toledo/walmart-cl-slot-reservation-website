import { expect, test } from "@playwright/test";

import { selectDemoAddress } from "./helpers";

test("fecha y horario elegidos muestran selección persistente sin mover la tarjeta", async ({
  page,
}) => {
  await page.goto("/");
  await selectDemoAddress(page, "Monjitas 2334, La Serena");

  const dates = page.getByRole("radiogroup", { name: "Fecha de despacho" });
  const availableDates = dates.locator(
    '[role="radio"]:not([aria-disabled="true"])',
  );
  const initialDate = dates.locator('[role="radio"][aria-checked="true"]');
  const initialDateLabel = await initialDate.getAttribute("aria-label");
  expect(await availableDates.count()).toBeGreaterThan(1);
  const date = availableDates.nth(1);
  await date.click();
  await expect(date).toBeVisible();
  await expect(date).toHaveAttribute("aria-checked", "true");
  await expect(
    dates.getByRole("radio", { name: initialDateLabel ?? "" }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(date).toHaveCSS("border-color", "rgb(0, 113, 206)");
  await expect(date).toHaveCSS("background-color", "rgb(240, 247, 253)");
  await expect(date).toHaveCSS("outline-style", "none");

  const slots = page.getByRole("radiogroup", { name: "Horario de despacho" });
  const slot = slots
    .locator('[role="radio"]:not([aria-disabled="true"])')
    .first();
  await expect(slot).toBeVisible();
  const before = await slot.boundingBox();
  await slot.click();
  await expect(slot).toHaveAttribute("aria-checked", "true");
  await expect(slot).toHaveCSS("border-color", "rgb(0, 113, 206)");
  await expect(slot).toHaveCSS("background-color", "rgb(240, 247, 253)");
  const after = await slot.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  expect(
    await slot.evaluate(
      (element) => getComputedStyle(element, "::after").content,
    ),
  ).toBe('"✓"');

  await expect(slot).toHaveAttribute("aria-checked", "true");
  await expect(date).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(slot).toBeFocused();
  await expect(slot).toHaveCSS("outline-color", "rgb(0, 43, 98)");

  await availableDates.first().click();
  await expect(date).toHaveAttribute("aria-checked", "false");
  await expect(slots).toBeVisible();
  await expect(
    slots.locator('[role="radio"][aria-checked="true"]'),
  ).toHaveCount(0);
});
