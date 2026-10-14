import { describe, expect, it } from "vitest";

import { queryKeys } from "@/api/queryKeys";

import { createQueryClient } from "./queryClient";

describe("createQueryClient", () => {
  it("configura reintento de query solo para red y mutaciones sin reintento", () => {
    const client = createQueryClient();
    const options = client.getDefaultOptions();
    const retry = options.queries?.retry;

    expect(typeof retry).toBe("function");
    if (typeof retry !== "function")
      throw new Error("Se esperaba una función de reintento.");
    expect(retry(0, { kind: "network", reason: "offline" } as never)).toBe(
      true,
    );
    expect(retry(1, { kind: "network", reason: "offline" } as never)).toBe(
      false,
    );
    expect(retry(0, { kind: "problem" } as never)).toBe(false);
    expect(options.mutations?.retry).toBe(0);
  });

  it("aplica por prefijo geo sin vencimiento y catalog con 15 s", () => {
    const client = createQueryClient();

    expect(client.getQueryDefaults(queryKeys.geo.comunas("13"))).toMatchObject({
      staleTime: Infinity,
    });
    expect(
      client.getQueryDefaults(
        queryKeys.catalog.slots("2030-01-15", { comunaCode: "13101" }),
      ),
    ).toMatchObject({ staleTime: 15_000, refetchOnWindowFocus: true });
  });
});
