import { QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { ApiClientProvider } from "@/api/ApiClientProvider";
import { createApiClient, type ApiClient } from "@/api/apiClient";
import { createHttpClient } from "@/api/http/httpClient";
import { createQueryClient } from "@/app/queryClient";
import { LiveAnnouncerProvider } from "@/shared/ui";

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  readonly apiClient?: ApiClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    apiClient = createApiClient(createHttpClient({ baseUrl: "" })),
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const queryClient = createQueryClient();
  function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={apiClient}>
          <LiveAnnouncerProvider>{children}</LiveAnnouncerProvider>
        </ApiClientProvider>
      </QueryClientProvider>
    );
  }
  return {
    ...render(ui, { wrapper: Providers, ...options }),
    queryClient,
    apiClient,
  };
}
