import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { endpoints } from "./endpoints";

describe("endpoints", () => {
  it("registers every app and E2E operation with its contract method, path and operationId", async () => {
    const contract = parse(
      await readFile(resolve(process.cwd(), "contract/openapi.yml"), "utf8"),
    ) as { paths: Record<string, Record<string, { operationId: string }>> };

    expect(endpoints).toHaveLength(12);
    for (const endpoint of endpoints) {
      const operation =
        contract.paths[endpoint.path]?.[endpoint.method.toLowerCase()];
      expect(operation?.operationId).toBe(endpoint.operationId);
    }
    expect(
      endpoints.find(
        (endpoint) => endpoint.operationId === "cancelReservation",
      ),
    ).toMatchObject({ e2eOnly: true });
  });
});
