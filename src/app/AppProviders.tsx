import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { ApiClientProvider } from "@/api/ApiClientProvider";
import { createApiClient } from "@/api/apiClient";
import { createHttpClient } from "@/api/http/httpClient";
import { apiBaseUrl } from "@/shared/config/env";
import { LiveAnnouncerProvider } from "@/shared/ui";

import { createQueryClient } from "./queryClient";

export function AppProviders({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [apiClient] = useState(() =>
    createApiClient(createHttpClient({ baseUrl: apiBaseUrl })),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <LiveAnnouncerProvider>{children}</LiveAnnouncerProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );
}
