import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { selectDemoAddress, selectFirstAvailableDateAndSlot } from "./helpers";
import { cleanupReservation } from "./reservationCleanup";

async function expectNoSeriousOrCritical(
  page: import("@playwright/test").Page,
) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

test.afterEach(async ({ page }) => {
  await cleanupReservation(page);
});

test("cumple accesibilidad y no desborda a 360 px", async ({ page }) => {
  await page.goto("/");
  await selectDemoAddress(page, "Monjitas 879, Santiago");
  await selectFirstAvailableDateAndSlot(page);
  await expectNoSeriousOrCritical(page);
  const noHorizontalOverflow = await page
    .locator("html")
    .evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(noHorizontalOverflow).toBeTruthy();

  await page.getByRole("button", { name: "Reservar" }).click();
  await expect(page.getByText("Tiempo para confirmar:")).toBeVisible();
  await expectNoSeriousOrCritical(page);

  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(
    page.getByRole("heading", { name: "¡Tu horario está reservado!" }),
  ).toBeVisible();
  await expectNoSeriousOrCritical(page);
});
