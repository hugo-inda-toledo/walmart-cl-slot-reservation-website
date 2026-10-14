import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "./axe";

describe("expectNoAxeViolations", () => {
  it("omite color-contrast y aprueba marcado accesible", async () => {
    const { container } = render(<button type="button">Continuar</button>);

    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it("falla ante una infracción real", async () => {
    const { container } = render(<input type="text" />);

    await expect(expectNoAxeViolations(container)).rejects.toThrow(/label/);
  });
});
