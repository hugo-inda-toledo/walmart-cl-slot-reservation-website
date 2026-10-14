import { describe, expect, it } from "vitest";

import { FIXTURES } from "../msw/fixtures";
import { validateFixture } from "./fixturesConformance";

describe("fixtures MSW", () => {
  it("conforms every fixture to its operation response schema", () => {
    for (const fixture of FIXTURES) {
      const result = validateFixture(fixture);
      expect(result.valid, `${fixture.name}: ${result.errors.join("; ")}`).toBe(
        true,
      );
    }
  });

  it("requires extensions which the shared Problem schema cannot express", () => {
    for (const [fixture, missing] of [
      [findFixture("create-hold-active-exists"), "holdId"],
      [findFixture("confirm-hold-not-active"), "holdStatus"],
      [findFixture("create-hold-slot-full"), "price"],
    ] as const) {
      const body = structuredClone(fixture.body) as Record<string, unknown>;
      if (missing === "price") {
        const alternative = (body.alternatives as Record<string, unknown>[])[0];
        if (alternative) delete alternative.price;
      } else if (missing === "holdStatus") {
        body.holdStatus = "BROKEN";
      } else {
        delete body.holdId;
      }

      expect(validateFixture({ ...fixture, body }).valid, fixture.name).toBe(
        false,
      );
    }
  });

  it("has one successful response for every consumed operation", () => {
    const operations = new Set(
      FIXTURES.filter(
        (fixture) => fixture.status >= 200 && fixture.status < 300,
      ).map((fixture) => fixture.operationId),
    );
    expect(operations).toEqual(
      new Set([
        "listRegions",
        "listComunasByRegion",
        "listDemoAddresses",
        "resolveCoverage",
        "listDeliveryDates",
        "listDeliverySlots",
        "createSlotHold",
        "getSlotHold",
        "releaseSlotHold",
        "confirmSlotHold",
        "getReservation",
        "cancelReservation",
      ]),
    );
  });
});

function findFixture(name: string) {
  const entry = FIXTURES.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`No existe la fixture ${name}.`);
  return entry;
}
