import { expect, test } from "@playwright/test";

import { selectDemoAddress } from "./helpers";

test("una fecha agotada no cambia la selección ni carga sus bloques", async ({
  page,
}) => {
  await page.goto("/");
  await selectDemoAddress(page, "Monjitas 2334, La Serena");

  const dates = page.getByRole("radiogroup", { name: "Fecha de despacho" });
  await expect(dates).toBeVisible();
  const selected = dates.locator('[role="radio"][aria-checked="true"]');
  const selectedDate = await selected.getAttribute("aria-label");
  const soldOut = dates.getByRole("radio", { name: /agotado/i });
  await expect(soldOut.first()).toHaveAttribute("aria-disabled", "true");

  await soldOut.first().click({ force: true });
  await expect(selected).toHaveAttribute("aria-label", selectedDate ?? "");
});
