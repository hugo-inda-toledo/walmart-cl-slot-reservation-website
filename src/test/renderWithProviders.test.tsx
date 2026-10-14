import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useApiClient } from "@/api/ApiClientProvider";

import { renderWithProviders } from "./renderWithProviders";

function Consumer() {
  useApiClient();
  return <output>api-client-ready</output>;
}

describe("renderWithProviders", () => {
  it("monta consumidores de useApiClient con un ApiClient real", () => {
    renderWithProviders(<Consumer />);

    expect(screen.getByText("api-client-ready")).toBeInTheDocument();
  });
});
