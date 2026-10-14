import { createContext, useContext, type ReactNode } from "react";

import type { ApiClient } from "./apiClient";

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({
  client,
  children,
}: {
  readonly client: ApiClient;
  readonly children?: ReactNode;
}) {
  return <ApiClientContext value={client}>{children}</ApiClientContext>;
}

// Provider y hook conviven por diseño (puerto inyectable único); el hook no es un componente.
// eslint-disable-next-line react-refresh/only-export-components
export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (client === null)
    throw new Error(
      "useApiClient debe utilizarse dentro de ApiClientProvider.",
    );
  return client;
}
