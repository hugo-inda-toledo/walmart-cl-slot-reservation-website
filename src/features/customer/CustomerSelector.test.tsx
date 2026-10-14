import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";

import { CustomerSelector, useCustomerSelection } from "./CustomerSelector";

function SelectionProbe() {
  const selection = useCustomerSelection();
  return (
    <CustomerSelector
      customer={selection.customer}
      onSelect={(id) => {
        selection.select(id);
      }}
    />
  );
}

describe("CustomerSelector", () => {
  it("selecciona Pedro Perez por defecto y conserva el cliente elegido en la sesión", async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<SelectionProbe />);
    const selector = screen.getByLabelText("Cliente demo");

    expect(selector).toHaveValue("pedro-perez");
    await user.selectOptions(selector, "maria-gonzalez");
    expect(selector).toHaveValue("maria-gonzalez");

    first.unmount();
    renderWithProviders(<SelectionProbe />);
    expect(screen.getByLabelText("Cliente demo")).toHaveValue("maria-gonzalez");
  });
});
