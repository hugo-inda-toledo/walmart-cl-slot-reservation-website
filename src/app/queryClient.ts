import { QueryClient } from "@tanstack/react-query";

import type { ApiError } from "@/api/http/apiError";
import { queryKeys } from "@/api/queryKeys";

function isNetworkError(
  error: unknown,
): error is Extract<ApiError, { readonly kind: "network" }> {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    error.kind === "network"
  );
}

const geoQueryOptions = { staleTime: Infinity } as const;
const catalogQueryOptions = {
  staleTime: 15_000,
  refetchOnWindowFocus: true,
} as const;

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          isNetworkError(error) && failureCount < 1,
      },
      mutations: { retry: 0 },
    },
  });
  client.setQueryDefaults(["geo"], geoQueryOptions);
  client.setQueryDefaults(queryKeys.catalog.all, catalogQueryOptions);
  return client;
}
