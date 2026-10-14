import type { AddressQuery } from "./catalogApi";

export const queryKeys = {
  geo: {
    regions: ["geo", "regions"],
    comunas: (region: string) => ["geo", "comunas", region],
    demoAddresses: ["geo", "demo-addresses"],
  },
  catalog: {
    all: ["catalog"],
    dates: (query: AddressQuery) => ["catalog", "dates", query],
    slots: (date: string, query: AddressQuery) => [
      "catalog",
      "slots",
      date,
      query,
    ],
  },
} as const;
